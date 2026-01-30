package com.project.domain.towingcar.scheduler;

import com.project.infra.mqtt.constant.MqttTopics;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class MockTrafficScheduler {

    private final MqttService mqttService;
    private double time = 0;

    // Safety Zone Center (Assume Map Center ~ 2000px / 0.05 res = 40000.. wait.
    // Let's use relative small meters.
    // If Map Resolution is 0.05, and Map Width is 2000px, then Width is 100m.
    // Center is 50m, 50m.
    // Let's orbit around 50, 50.

    // @Scheduled(fixedRate = 100) // 10Hz
    public void simulate() {
        // TC02: Circular Motion around (50, 50) with radius 15m
        double centerX = 50.0;
        double centerY = 50.0;
        // TC03 (Linear Patrol) - Removed to silence warnings
        double radius = 15.0;

        // TC02 (Circle)
        double x2 = centerX + radius * Math.cos(time);
        double y2 = centerY + radius * Math.sin(time);

        // Payload Construction (Using Map to avoid Double Serialization)
        Map<String, Object> payloadTC01 = new HashMap<>();
        payloadTC01.put("carId", "TC01");
        payloadTC01.put("lat", x2); // Using x as lat (mock)
        payloadTC01.put("lng", 0.0);
        payloadTC01.put("x", x2);
        payloadTC01.put("y", y2);
        payloadTC01.put("yaw", 90.0);
        payloadTC01.put("v", 1.5);
        payloadTC01.put("battery", 88);
        payloadTC01.put("mode", "MOVING_TO_LOAD");
        payloadTC01.put("status", "job");
        payloadTC01.put("timestamp", LocalDateTime.now().toString());

        // Publish to MQTT Broker (Loopback)
        mqttService.publish(MqttTopics.SUB_MONITORING, payloadTC01);

        time += 0.05;

        if (time > 10000)
            time = 0; // Prevent overflow

        // [Map Fix] Send Mock Map Data ONCE to fix Frontend "Invalid Map Data" error
        sendMockMap();
    }

    // Send map periodically (e.g. every 5 seconds = every 50 ticks at 10Hz)
    private int mapTickCounter = 0;

    // Mock Map Data Injection
    private void sendMockMap() {
        mapTickCounter++;
        // Send every 50 ticks (5 seconds)
        if (mapTickCounter % 50 != 0)
            return;

        // Corrected Schema: map_id (snake_case), id (String)
        Map<String, Object> mockMapPayload = new HashMap<>();
        mockMapPayload.put("map_id", "MOCK_MAP_01");
        mockMapPayload.put("width", 100);
        mockMapPayload.put("height", 100);

        List<Map<String, Object>> nodes = new ArrayList<>();
        nodes.add(Map.of("id", "1", "x", 0, "y", 0, "status", "active"));
        nodes.add(Map.of("id", "2", "x", 100, "y", 0, "status", "active"));
        nodes.add(Map.of("id", "3", "x", 100, "y", 100, "status", "active"));
        nodes.add(Map.of("id", "4", "x", 0, "y", 100, "status", "active"));
        mockMapPayload.put("nodes", nodes);

        Map<String, Object> corners = new HashMap<>();
        corners.put("TL", Map.of("x", 0, "y", 100));
        corners.put("TR", Map.of("x", 100, "y", 100));
        corners.put("BL", Map.of("x", 0, "y", 0));
        corners.put("BR", Map.of("x", 100, "y", 0));
        mockMapPayload.put("corners", corners);

        // Publish to Map Topic (autowing_car/v1/map)
        mqttService.publish(MqttTopics.SUB_MAP_INFO, mockMapPayload);
        log.info("✅ [MockScheduler] Periodically Sent Mock Map Data: MOCK_MAP_01");
    }
}
