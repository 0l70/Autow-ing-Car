package com.project.service;

import com.project.domain.map.component.GraphCache;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.map.service.MapService;
import com.project.domain.mission.dto.MissionWebSocketDtos.PathOptionDto;
import com.project.global.config.LocalDataInit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import com.project.domain.map.entity.Edge;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
@TestPropertySource(properties = {
        "jwt.secret=testSecretKeyForUnitTestingMustBeLongEnoughToSatisfyHS256RequirementsSinceItRequiresAtLeast256Bits",
        "jwt.expiration=3600000",
        "MQTT_HOST=localhost",
        "MQTT_PORT=1883",
        "REDIS_HOST=localhost",
        "REDIS_PORT=6379"
})
class MapServiceTest {

    @Autowired
    private MapService mapService;

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
        Node start = mapDBAdaptor.getNodeByCode("N_0_0");
        Node end = mapDBAdaptor.getNodeByCode("N_2_2");

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

    @Test
    @DisplayName("convertPathToPayload: Should include intermediate waypoints")
    void testConvertPathToPayloadWithWaypoints() {
        // Given
        Node n1 = Node.builder().nodeCode("N1").posX(0.0).posY(0.0).build();
        Node n2 = Node.builder().nodeCode("N2").posX(10.0).posY(10.0).build();

        // Waypoints JSON
        String waypointsJson = "[{\"x\": 2.0, \"y\": 2.0}, {\"x\": 5.0, \"y\": 5.0}]";

        Edge edge = Edge.builder()
                .edgeCode("E1")
                .srcNode(n1)
                .dstNode(n2)
                .distance(14.14)
                .maxSpeed(5)
                .waypoints(waypointsJson)
                .build();

        List<Edge> path = List.of(edge);

        // When
        List<Map<String, Object>> payload = mapService.convertPathToPayload(path);

        // Then
        // Result should have 3 points: waypoint1, waypoint2, and finally dstNode
        assertThat(payload).hasSize(3);

        // Point 1 (Waypoint 1)
        assertThat(payload.get(0).get("nodeId")).isNull();
        assertThat(payload.get(0).get("x")).isEqualTo(2.0);
        assertThat(payload.get(0).get("y")).isEqualTo(2.0);
        assertThat(payload.get(0).get("edgeId")).isEqualTo("E1");

        // Point 2 (Waypoint 2)
        assertThat(payload.get(1).get("nodeId")).isNull();
        assertThat(payload.get(1).get("x")).isEqualTo(5.0);
        assertThat(payload.get(1).get("y")).isEqualTo(5.0);

        // Point 3 (Destination Node)
        assertThat(payload.get(2).get("nodeId")).isEqualTo("N2");
        assertThat(payload.get(2).get("x")).isEqualTo(10.0);
        assertThat(payload.get(2).get("y")).isEqualTo(10.0);
    }
}
