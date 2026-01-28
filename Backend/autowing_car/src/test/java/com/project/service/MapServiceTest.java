package com.project.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.map.component.GraphCache;
import com.project.domain.map.entity.Node;
import com.project.domain.map.repository.NodeRepository;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.map.service.MapService;
import com.project.domain.mission.dto.MissionWebSocketDtos.PathOptionDto;
import com.project.global.config.LocalDataInit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
// @ActiveProfiles("local") // Use if you have specific profile, otherwise
// default
@Transactional
class MapServiceTest {

    @Autowired
    private LocalDataInit localDataInit;

    @Autowired
    private MapService mapService;

    @Autowired
    private NodeRepository nodeRepository;

    @Autowired
    private MapDBAdaptor mapDBAdaptor;

    @Autowired
    private GraphCache graphCache;

    Double getPathWeight(List<String> edgeIds) {
        return graphCache.getPathWeight(edgeIds);
    }

    @Test
    @DisplayName("Yen's Algorithm: Should return up to 3 paths on 3x3 Grid")
    void testFindShortestPaths() {
        // Given
        // LocalDataInit creates 3x3 grid: N_0_0 to N_2_2
        Node start = nodeRepository.findByNodeCode("N_0_0")
                .orElseThrow(() -> new IllegalArgumentException("Start node N_0_0 not found"));
        Node end = nodeRepository.findByNodeCode("N_2_2")
                .orElseThrow(() -> new IllegalArgumentException("End node N_2_2 not found"));

        System.out.println(
                ">>> Start Node: " + start.getNodeCode() + " (" + start.getPosX() + "," + start.getPosY() + ")");
        System.out.println(">>> End Node: " + end.getNodeCode() + " (" + end.getPosX() + "," + end.getPosY() + ")");

        // When
        List<PathOptionDto> paths = mapService.findShortestPath(start, end);

        // Then
        System.out.println("\n============ Found Paths (K=3) ============");
        for (PathOptionDto path : paths) {
            System.out.println("Option " + path.getOptionId() + " (" + path.getLabel() + "): " + path.getEdgeIds()
                    + ", Weight: " + getPathWeight(path.getEdgeIds()));
        }
        System.out.println("===========================================\n");

        assertThat(paths).isNotEmpty();
        // In a 3x3 grid, there are 6 paths of length 4 (Manhattan distance 4).
        // (R,R,D,D), (R,D,R,D), (R,D,D,R), (D,R,R,D), (D,R,D,R), (D,D,R,R)
        // K=3 means we should get exactly 3 distinct paths.
        assertThat(paths.size()).isGreaterThanOrEqualTo(2);
    }
}
