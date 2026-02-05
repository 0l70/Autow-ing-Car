package com.project.global.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.repository.EdgeRepository;
import com.project.domain.map.repository.NodeRepository;
import com.project.global.util.RdpSimplifier;
import com.project.domain.common.MapStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class MapLoadingService {

    private final EdgeRepository edgeRepository;
    private final NodeRepository nodeRepository;
    private final ObjectMapper objectMapper;

    // Filename regex: path_S01_to_G01.json or path_S01_to_G01_timestamp.json
    private static final Pattern FILENAME_PATTERN = Pattern.compile("path_([A-Z0-9]+)_to_([A-Z0-9]+).*\\.json");

    @Transactional
    public void loadAll(List<Resource> resources) {
        log.info("Starting batch load for {} map files...", resources.size());

        for (Resource resource : resources) {
            processResource(resource);
        }

        log.info("Successfully loaded all map files.");
    }

    private void processResource(Resource resource) {
        try {
            String filename = resource.getFilename();
            if (filename == null) {
                log.warn("Skipping resource with no filename: {}", resource.getDescription());
                return;
            }

            Matcher matcher = FILENAME_PATTERN.matcher(filename);
            if (!matcher.find()) {
                log.warn("Skipping file matching no pattern: {}", filename);
                return;
            }

            String startNodeCode = matcher.group(1);
            String endNodeCode = matcher.group(2);

            Node srcNode = nodeRepository.findByNodeCode(startNodeCode)
                    .orElseThrow(() -> new IllegalStateException("Node not found: " + startNodeCode));
            Node dstNode = nodeRepository.findByNodeCode(endNodeCode)
                    .orElseThrow(() -> new IllegalStateException("Node not found: " + endNodeCode));

            try (InputStream is = resource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                JsonNode xArray = root.get("x");
                JsonNode yArray = root.get("y");

                double coordinateCount = (double) xArray.size();

                List<RdpSimplifier.Point> rawPoints = new ArrayList<>();
                for (int i = 0; i < xArray.size(); i++) {
                    rawPoints.add(new RdpSimplifier.Point(xArray.get(i).asDouble(), yArray.get(i).asDouble()));
                }

                List<RdpSimplifier.Point> simplified = RdpSimplifier.simplify(rawPoints, 0.1);
                String waypointsJson = objectMapper.writeValueAsString(simplified);

                // Forward Edge
                upsertEdge("E_" + startNodeCode + "_to_" + endNodeCode,
                        srcNode, dstNode, coordinateCount, waypointsJson);

                // Reverse Edge
                List<RdpSimplifier.Point> reversed = new ArrayList<>(simplified);
                Collections.reverse(reversed);
                String reversedWaypointsJson = objectMapper.writeValueAsString(reversed);

                upsertEdge("E_" + endNodeCode + "_to_" + startNodeCode,
                        dstNode, srcNode, coordinateCount, reversedWaypointsJson);

                log.info("Loaded path {} -> {} from {}", startNodeCode, endNodeCode, filename);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to load map resource: " + resource.getDescription(), e);
        }
    }

    private void upsertEdge(String edgeCode, Node src, Node dst, Double distance, String waypoints) {
        edgeRepository.findByEdgeCode(edgeCode).ifPresentOrElse(
                edge -> {
                    edge.updatePath(waypoints, distance); // Explicit Update
                    log.debug("Updated edge: {}", edgeCode);
                },
                () -> {
                    Edge newEdge = Edge.builder()
                            .edgeCode(edgeCode)
                            .srcNode(src)
                            .dstNode(dst)
                            .distance(distance)
                            .maxSpeed(11) // Default speed or could be derived
                            .travelTime(11 * distance)
                            .waypoints(waypoints)
                            .status(MapStatus.AVAILABLE)
                            .restrictionInfo("NONE")
                            .build();
                    edgeRepository.save(newEdge);
                    log.debug("Created edge: {}", edgeCode);
                });
    }
}
