package com.project.domain.towingcar.scheduler;

import com.project.domain.common.CarStatus;
import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarWebSocketService;
import com.project.infra.mqtt.constant.MqttTopics;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnProperty(name = "app.mqtt.mock", havingValue = "false")
public class MockTrafficScheduler {

    private final MqttService mqttService;
    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final TowingCarWebSocketService towingCarWebSocketService;

    private double time = 0;
    private final Map<String, Integer> loadingCounters = new HashMap<>();

    // [NEW] Flight Info Tick Counter
    private int flightInfoTick = 0;

    @Scheduled(fixedRate = 1000) // 10Hz
    public void simulate() {
        double centerX = 50.0;
        double centerY = 50.0;
        double radius = 15.0;

        // Simulate multiple cars
        simulateCar("TC01", centerX, centerY, radius, 0);
        // simulateCar("TC00", centerX + 10, centerY, radius, Math.PI); // Opposite side

        time += 0.05;
        if (time > 10000)
            time = 0;

        // [Map Fix] Send Mock Map Data ONCE to fix Frontend "Invalid Map Data" error
        sendMockMap();

        // [Flight Info Fix] Send Mock Flight Data periodically
        flightInfoTick++;
        if (flightInfoTick % 20 == 0) { // Every 2 seconds (100ms * 20)
            sendMockFlightInfo();
        }
    }

    private void simulateCar(String carId, double cx, double cy, double r, double offset) {
        // 1. Get Real Status from DB
        TowingCar car = towingCarDBAdaptor.getCarByCode(carId);
        CarStatus currentStatus = (car != null) ? car.getCarStatus() : CarStatus.IDLE;
        String modeToSend = "IDLE";

        // Physics Override for Teleport
        boolean forceGatePos = false;

        // Default Status Mapping
        modeToSend = currentStatus.name();

        // 2. Logic for MOVING_TO_LOAD -> Arrive at Gate (Trigger Auto Connect)
        if (currentStatus == CarStatus.MOVING_TO_LOAD) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 30) { // 3 seconds travel
                // Teleport to Gate to trigger Auto Connect in Service
                forceGatePos = true;
                if (count == 31)
                    log.info("✅ [Mock] {} Arrived at Gate (MOVING -> AUTO CONNECT)", carId);
            }
            // modeToSend remains MOVING_TO_LOAD
        }
        // 3. Logic for LOADING -> TOWING (Connect)
        else if (currentStatus == CarStatus.LOADING) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 30) {
                modeToSend = "TOWING";
                if (count == 31)
                    log.info("✅ [Mock] {} Connected (LOADING -> TOWING)", carId);
            } else {
                modeToSend = "LOADING";
            }
        }
        // 4. Logic for UNLOADING -> IDLE (Disconnect)
        else if (currentStatus == CarStatus.UNLOADING) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 30) {
                modeToSend = "IDLE";
                if (count == 31)
                    log.info("✅ [Mock] {} Disconnected (UNLOADING -> IDLE)", carId);
            } else {
                modeToSend = "UNLOADING";
            }
        } else {
            loadingCounters.remove(carId);
        }

        // 3. Physics Simulation (Default Circle)
        double t = time + offset;
        double x = cx + r * Math.cos(t);
        double y = cy + r * Math.sin(t);
        double v = 1.5 + Math.random();
        double yaw = (t * 180 / Math.PI + 90) % 360;

        // [Override] Gate Position for Auto Connect
        if (forceGatePos) {
            x = -50.0; // Gate 101 Position
            y = 0.0;
            v = 0.0;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("carId", carId);
        payload.put("x", x);
        payload.put("y", y);
        payload.put("yaw", yaw);
        payload.put("v", v);
        payload.put("battery", 80 + (int) (Math.sin(time) * 10));
        payload.put("mode", modeToSend); // Injected Status
        payload.put("status", "job"); // Display requirement
        payload.put("timestamp", LocalDateTime.now().toString());

        mqttService.publish(MqttTopics.SUB_MONITORING, payload);

        // [LOOPBACK] Directly send to WebSocket to ensure UI updates even if MQTT
        // broker is unreachable or loopback fails
        try {
            towingCarWebSocketService.broadcastCarStatus(carId, payload);
        } catch (Exception e) {
            log.warn("Mock loopback failed: {}", e.getMessage());
        }
    }

    // Send map periodically (e.g. every 5 seconds = every 50 ticks at 10Hz)
    private int mapTickCounter = 0;

    private void sendMockMap() {
        mapTickCounter++;
        if (mapTickCounter % 50 != 0)
            return;

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

        mqttService.publish(MqttTopics.SUB_MAP_INFO, mockMapPayload);
        log.info("✅ [MockScheduler] Periodically Sent Mock Map Data: MOCK_MAP_01");
    }

    // [NEW] Mock Flight Info Sender
    private void sendMockFlightInfo() {
        // Mock Data: Matches Frontend 'pilot' user expectation
        // Note: The pilotId here matches "pilot" which is the test account,
        // OR it matches the token-based principal name if we were dynamically checking.
        // For mock scheduler, we broadcast to a specific test user 'pilot'.

        FlightInfoDto mockFlight = FlightInfoDto.builder()
                .flightId(101L)
                .flightNumber("KE023")
                .pilotName("Captain Kim")
                .aircraftRegistrationNum("HL7755")
                .aircraftTypeCode("B777")
                .destination("SFO")
                .departureTime("14:30")
                .gateNode("GATE_23")
                .assignedCarId("TUG-004") // MUST Match 'TC01' or similar if we want physics to work?
                                          // Actually TUG-004 is often used in frontend mock data.
                                          // Let's use TUG-004 to be safe or TC01.
                                          // Looking at existing mock data: TC01 used in physics.
                                          // Let's use TC01 to ensure map visualization works for "My Car".
                .assignedCarId("TC01")
                .build();

        // Send to 'pilot@atc.com' user (The actual login ID)
        // Ensure that the frontend user logs in as 'pilot@atc.com'.
        towingCarWebSocketService.notifyPilotFlightInfo("pilot@atc.com", mockFlight);

        // Also send to 'admin' or generic topics if needed, but for now specific user
        // only.
        // log.info("✅ [MockScheduler] Sent Mock Flight Info: KE023 -> pilot");
    }
}
