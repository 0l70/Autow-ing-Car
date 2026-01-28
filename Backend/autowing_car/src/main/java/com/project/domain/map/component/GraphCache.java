package com.project.domain.map.component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class GraphCache {

    private final MapDBAdaptor mapDBAdaptor;

    // srcNodeId -> outgoing edges
    // srcNodeId -> outgoing edges
    private Map<Long, List<Edge>> adjacencyMap = new HashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void init() {
        log.info("[GraphCache] Initializing... (After Context Ready)");
        reload();
    }

    @Scheduled(fixedRate = 60 * 1000) // 1분마다 갱신
    public void scheduledReload() {
        reload();
    }

    public synchronized void reload() {
        log.info("[GraphCache] Reloading edges from DB...");
        adjacencyMap.clear();

        List<Edge> allEdges = mapDBAdaptor.findAllEdges();
        for (Edge edge : allEdges) {
            adjacencyMap
                    .computeIfAbsent(edge.getSrcNode().getId(), k -> new ArrayList<>())
                    .add(edge);
        }
        log.info("[GraphCache] Loaded {} edges.", allEdges.size());
    }

    public List<Edge> getEdges(Node node) {
        return adjacencyMap.getOrDefault(node.getId(), List.of());
    }

    public Double getPathWeight(List<String> edgeIds) {
        return edgeIds.stream()
                .mapToDouble(edgeId -> mapDBAdaptor.getEdgeByCode(edgeId).getDistance())
                .sum();
    }
}
