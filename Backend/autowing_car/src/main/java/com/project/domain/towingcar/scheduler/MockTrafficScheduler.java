package com.project.domain.towingcar.scheduler;

import com.project.domain.common.CarStatus;
import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository; // [NEW] Direct Repository Access
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
@ConditionalOnProperty(name = "app.mqtt.mock", havingValue = "true")
public class MockTrafficScheduler {

    private final MqttService mqttService;
    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final TowingCarRepository towingCarRepository; // [NEW] Direct Repository Access
    private final TowingCarWebSocketService towingCarWebSocketService;

    private double time = 0;
    private final Map<String, Integer> loadingCounters = new HashMap<>();

    // [NEW] Flight Info Tick Counter
    private int flightInfoTick = 0;

    @Scheduled(fixedRate = 500) // 20Hz
    public void simulate() {
        // [Map Config] Aligned with S14P11A402 Map (Origin: -5.42, -3.68)
        // Center of Lower Viewport (Pixel 163, 206) -> World (2.75, -0.23)
        double centerX = 2.75;
        double centerY = -0.23;
        double radius = 1.5;

        // [Simulate ALL DB Cars]
        // Using Repository directly to avoid modifying DBAdaptor logic
        List<TowingCar> allCars = towingCarRepository.findAll();

        for (int i = 0; i < allCars.size(); i++) {
            TowingCar car = allCars.get(i);
            // Give each car a different phase/offset so they don't stack
            double offset = i * (Math.PI / 4);
            simulateCar(car, centerX, centerY, radius, offset);
        }

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

    private void simulateCar(TowingCar car, double cx, double cy, double r, double offset) {
        String carId = car.getCode();
        // 1. Use Real Status & Battery from Object (No DB lookup needed)
        CarStatus currentStatus = car.getCarStatus();
        Integer battery = car.getBattery();

        String modeToSend = currentStatus.name();

        // Physics Override for Teleport
        boolean forceGatePos = false;

        // 2. Logic for MOVING_TO_LOAD -> Arrive at Gate (Trigger Auto Connect)
        if (currentStatus == CarStatus.MOVING_TO_LOAD) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 30) { // 3 seconds travel
                // Teleport to Gate to trigger Auto Connect in Service
                forceGatePos = true;
                if (count == 31)
                    log.info("✅ [Mock] {} Arrived at Gate", carId);
            }
        }
        // 3. Logic for LOADING -> TOWING (Connect)
        else if (currentStatus == CarStatus.LOADING) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 3) {
                modeToSend = "TOWING";
                if (count == 31) {
                    log.info("✅ [Mock] {} Connected", carId);
                    towingCarWebSocketService.notifyPilotResult("pilot@atc.com",
                            MissionResponseDto.builder()
                                    .status("SUCCESS")
                                    .message("Connected Successfully")
                                    .build());
                }
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
                    log.info("✅ [Mock] {} Disconnected", carId);
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

        // [Override] Gate Position for Auto Connect (mock behavior)
        if (forceGatePos) {
            x = 2.0;
            y = 0.0;
            v = 0.0;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("carId", carId);
        payload.put("code", carId);
        payload.put("type", "TUG"); // [FIX] Explicit Type for Schema Validation
        payload.put("x", x);
        payload.put("y", y);
        payload.put("yaw", yaw);
        payload.put("v", v);
        payload.put("battery", battery);
        payload.put("mode", modeToSend);
        payload.put("status", modeToSend);
        payload.put("timestamp", LocalDateTime.now().toString());

        // 3. [ATC & Pilot] Broadcast to /topic/car/{carCode}
        // ATC subscribes to ALL (or specific range).
        // Pilot subscribes to THEIR car.
        // Backend simply broadcasts to the channel.

        mqttService.publish(MqttTopics.SUB_MONITORING, payload);
        towingCarWebSocketService.broadcastCarStatus(carId, payload);
    }

    // Send map periodically (e.g. every 5 seconds = every 50 ticks at 10Hz)
    private int mapTickCounter = 0;

    private void sendMockMap() {
        mapTickCounter++;
        if (mapTickCounter % 50 != 0)
            return;

        Map<String, Object> mockMapPayload = new HashMap<>();
        mockMapPayload.put("map_id", "MOCK_MAP_01");
        mockMapPayload.put("width", 327); // [Map Fix] Match real map width
        mockMapPayload.put("height", 275); // [Map Fix] Match real map height

        List<Map<String, Object>> nodes = new ArrayList<>();
        // 1. RUNWAY (Central Horizontal)
        nodes.add(
                Map.of("id", "RWY_L", "x", 200, "y", 750, "status", "active", "label", "Runway 09", "type", "RUNWAY"));
        nodes.add(
                Map.of("id", "RWY_R", "x", 1800, "y", 750, "status", "active", "label", "Runway 27", "type", "RUNWAY"));

        // 2. INTERSECTIONS (Taxiway Crossings)
        nodes.add(Map.of("id", "INT_1", "x", 600, "y", 750, "status", "active", "label", "Taxiway A", "type",
                "INTERSECTION"));
        nodes.add(Map.of("id", "INT_2", "x", 1400, "y", 750, "status", "active", "label", "Taxiway B", "type",
                "INTERSECTION"));

        // 3. GATES (Top)
        nodes.add(
                Map.of("id", "GATE_1", "x", 600, "y", 200, "status", "occupied", "label", "Gate 101", "type", "GATE"));
        nodes.add(Map.of("id", "GATE_2", "x", 1400, "y", 200, "status", "free", "label", "Gate 102", "type", "GATE"));

        // 4. PARKING / CHARGERS (Bottom)
        nodes.add(Map.of("id", "PARK_1", "x", 600, "y", 1300, "status", "active", "label", "Charger A", "type",
                "CHARGER"));
        nodes.add(Map.of("id", "PARK_2", "x", 1400, "y", 1300, "status", "active", "label", "Charger B", "type",
                "CHARGER"));

        mockMapPayload.put("nodes", nodes);

        // [NEW] EDGES (Connections)
        List<Map<String, Object>> edges = new ArrayList<>();
        // Runway Backbone
        edges.add(Map.of("id", "e1", "from", "RWY_L", "to", "INT_1", "cost", 10.0));
        edges.add(Map.of("id", "e2", "from", "INT_1", "to", "INT_2", "cost", 20.0));
        edges.add(Map.of("id", "e3", "from", "INT_2", "to", "RWY_R", "cost", 10.0));

        // Vertical Connections (Taxiways)
        edges.add(Map.of("id", "e4", "from", "INT_1", "to", "GATE_1", "cost", 15.0));
        edges.add(Map.of("id", "e5", "from", "INT_2", "to", "GATE_2", "cost", 15.0));
        edges.add(Map.of("id", "e6", "from", "INT_1", "to", "PARK_1", "cost", 15.0));
        edges.add(Map.of("id", "e7", "from", "INT_2", "to", "PARK_2", "cost", 15.0));

        mockMapPayload.put("edges", edges);

        Map<String, Object> corners = new HashMap<>();
        corners.put("TL", Map.of("x", 0, "y", 1500));
        corners.put("TR", Map.of("x", 2000, "y", 1500));
        corners.put("BL", Map.of("x", 0, "y", 0));
        corners.put("BR", Map.of("x", 2000, "y", 0));
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
