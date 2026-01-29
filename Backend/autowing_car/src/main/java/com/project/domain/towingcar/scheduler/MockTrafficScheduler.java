package com.project.domain.towingcar.scheduler;

import com.project.infra.mqtt.config.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class MockTrafficScheduler {

    private final MqttOutboundService mqttService;
    private double time = 0;

    // Safety Zone Center (Assume Map Center ~ 2000px / 0.05 res = 40000.. wait.
    // Let's use relative small meters.
    // If Map Resolution is 0.05, and Map Width is 2000px, then Width is 100m.
    // Center is 50m, 50m.
    // Let's orbit around 50, 50.

    @Scheduled(fixedRate = 100) // 10Hz
    public void simulate() {
        // TC02: Circular Motion around (50, 50) with radius 15m
        double centerX = 50.0;
        double centerY = 50.0;
        double radius = 15.0;

        // TC02 (Circle)
        double x2 = centerX + radius * Math.cos(time);
        double y2 = centerY + radius * Math.sin(time);

        // TC03 (Linear Patrol)
        // Oscillates between (30, 70) and (70, 70)
        double x3 = 30.0 + (40.0 * (Math.sin(time * 0.5) + 1) / 2);
        double y3 = 70.0;

        // Payload Construction (Mimicking Real Robot JSON)
        String payloadTC01 = String.format("""
                    {
                        "carId": "TC01",
                        "lat": %.2f, "lng": 0.0,
                        "x": %.2f, "y": %.2f,
                        "yaw": 90.0,
                "v": 1.5, "battery": 88,
                "mode": "MOVING_TO_LOAD", "status": "job",
                "timestamp": "%s"
                    }
                """, x2, x2, y2, LocalDateTime.now());

        /*
         * // TC03 is not in DB yet
         * String payloadTC03 = String.format("""
         * {
         * "carId": "TC03",
         * "lat": %.2f, "lng": 0.0,
         * "x": %.2f, "y": %.2f,
         * "v": 2.0, "battery": 72,
         * "mode": "MOVING", "status": "job",
         * "timestamp": "%s"
         * }
         * """, x3, x3, y3, LocalDateTime.now());
         */

        // Publish to MQTT Broker (Loopback)
        mqttService.publish(MqttTopics.SUB_MONITORING, payloadTC01);
        // mqttService.publish(MqttTopics.SUB_MONITORING, payloadTC03);

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
        String mockMapPayload = """
                    {
                        "map_id": "MOCK_MAP_01",
                        "width": 100, "height": 100,
                        "nodes": [
                            {"id": "1", "x": 0, "y": 0, "status": "active"},
                            {"id": "2", "x": 100, "y": 0, "status": "active"},
                            {"id": "3", "x": 100, "y": 100, "status": "active"},
                            {"id": "4", "x": 0, "y": 100, "status": "active"}
                        ],
                        "corners": {
                            "TL": {"x": 0, "y": 100},
                            "TR": {"x": 100, "y": 100},
                            "BL": {"x": 0, "y": 0},
                            "BR": {"x": 100, "y": 0}
                        }
                    }
                """;

        // Publish to Map Topic (autowing_car/v1/map)
        mqttService.publish(MqttTopics.SUB_MAP_INFO, mockMapPayload);
        log.info("✅ [MockScheduler] Periodically Sent Mock Map Data: MOCK_MAP_01");
    }
}
