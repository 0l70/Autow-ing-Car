package com.project.domain.towingcar.scheduler;

import com.project.domain.common.CarStatus;
import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository; // [NEW] Direct Repository Access
import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.repository.EdgeRepository;
import com.project.domain.map.repository.NodeRepository;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarWebSocketService;
import com.project.domain.map.service.MapWebSocketService;
import com.project.infra.mqtt.constant.MqttTopics;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 테스트용 가상 트래픽 시뮬레이터
 * DB에 등록된 모든 차량의 위치를 주기적으로 계산하고, 비행 정보와 지도를 웹소켓/MQTT로 방송합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.mqtt.mock", havingValue = "true")
public class MockTrafficScheduler {

    private final MqttService mqttService;
    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final TowingCarRepository towingCarRepository; // [NEW] Direct Repository Access
    private final FlightRepository flightRepository; // [NEW] Flight DB Access
    private final NodeRepository nodeRepository; // [NEW] Use DB for Map
    private final EdgeRepository edgeRepository; // [NEW] Use DB for Map
    private final TowingCarWebSocketService towingCarWebSocketService;
    private final MapWebSocketService mapWebSocketService;

    private double time = 0;
    private final Map<String, Integer> loadingCounters = new HashMap<>();

    // 시뮬레이션 메인 루프 (1초마다 실행)
    // @Scheduled(fixedRate = 1000) // 1Hz for quieter debugging
    @Transactional(readOnly = true)
    public void simulate() {
        try {
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

        } catch (Exception e) {
            log.error("❌ [MockTrafficScheduler] Error in simulate loop: {}", e.getMessage(), e);
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
        if (currentStatus == CarStatus.MOVING_TO_GATE) {
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
        else if (currentStatus == CarStatus.DOCKING) {
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
                modeToSend = "DOCKING";
            }
        }
        // 4. Logic for UNDOCKING -> IDLE (Disconnect)
        else if (currentStatus == CarStatus.UNDOCKING) {
            int count = loadingCounters.getOrDefault(carId, 0);
            count++;
            loadingCounters.put(carId, count);

            if (count > 30) {
                modeToSend = "WAITING_FOR_RETURN";
                if (count == 31)
                    log.info("✅ [Mock] {} Disconnected", carId);
            } else {
                modeToSend = "UNDOCKING";
            }
        } else {
            loadingCounters.remove(carId);
        }

        // 3. Physics Simulation (Patrol Path)
        // Path: Start(3.08, 3.02) <-> End(0.28, -1.68)
        double startX = 3.08;
        double startY = 3.02;
        double endX = 0.28;
        double endY = -1.68;

        // Oscillate t between 0 and 1
        // time increases by 0.05 per tick.
        // Cycle: 0 -> 1 -> 0
        double speedFactor = 0.05; // Speed multiplier
        double cycle = (time * speedFactor + offset) % 2.0;
        double t = cycle > 1.0 ? 2.0 - cycle : cycle; // 0..1..0

        // Lerp
        double x = startX + (endX - startX) * t;
        double y = startY + (endY - startY) * t;

        // Calculate Yaw (Direction)
        // dx, dy direction
        double dx = endX - startX;
        double dy = endY - startY;
        double yawVal = Math.toDegrees(Math.atan2(dy, dx)); // -180 ~ 180
        if (cycle > 1.0)
            yawVal += 180; // Reverse direction on return

        // Convert to 0-360 for consistent format if needed, but standard is usually
        // fine
        double yaw = (yawVal + 360) % 360;
        double v = 5.0; // 5 m/s constant speed

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

    /**
     * 주기적으로 지도 데이터(노드, 간선)를 방송합니다.
     * (현재는 초기 HTTP 로딩을 주로 사용하지만, 실시간 변경 대응을 위해 유지)
     */
    private void sendMockMap() {
        mapTickCounter++;
        if (mapTickCounter % 2 != 0)
            return;

        Map<String, Object> mockMapPayload = new HashMap<>();
        mockMapPayload.put("map_id", "final_map");

        // Fetch Real Map Data from DB
        List<Node> dbNodes = nodeRepository.findAll();
        List<Edge> dbEdges = edgeRepository.findAll();

        List<Map<String, Object>> nodes = new ArrayList<>();
        for (Node n : dbNodes) {
            Map<String, Object> nodeMap = new HashMap<>();
            nodeMap.put("id", n.getNodeCode());
            nodeMap.put("x", n.getPosX());
            nodeMap.put("y", n.getPosY());
            nodeMap.put("status", n.getStatus().name());
            nodes.add(nodeMap);
        }

        mockMapPayload.put("nodes", nodes);

        List<Map<String, Object>> edges = new ArrayList<>();
        for (Edge e : dbEdges) {
            Map<String, Object> edgeMap = new HashMap<>();
            edgeMap.put("id", e.getEdgeCode());
            edgeMap.put("from", e.getSrcNode().getNodeCode());
            edgeMap.put("to", e.getDstNode().getNodeCode());
            edgeMap.put("cost", e.getDistance());
            edges.add(edgeMap);
        }

        mockMapPayload.put("edges", edges);

        mqttService.publish(MqttTopics.SUB_MAP_INFO, mockMapPayload);
        // [Debug Sync] Also broadcast directly via WebSocket to bypass MQTT bridge
        // issues
        mapWebSocketService.broadcastMapInfo(mockMapPayload);
        log.info("✅ [MockScheduler] Periodically Sent DB Map Data ({})", dbNodes.size());
    }

    // [REFACTORED] Flight Info Sender - Now uses DB data
    private void sendMockFlightInfo() {
        List<Flight> allFlights = flightRepository.findAll();

        if (allFlights.isEmpty()) {
            // Fallback: 테스트용 Mock 데이터 (DB에 데이터가 없는 경우)
            log.debug("[MockScheduler] No flights in DB, sending fallback mock data");
            FlightInfoDto mockFlight = FlightInfoDto.builder()
                    .flightId(0L)
                    .flightNumber("TEST-001")
                    .pilotName("Test Pilot")
                    .aircraftRegistrationNum("N/A")
                    .aircraftTypeCode("N/A")
                    .destination("N/A")
                    .departureTime("--:--")
                    .gateNode("N/A")
                    .assignedCarId("TC01")
                    .build();
            towingCarWebSocketService.notifyPilotFlightInfo("pilot@atc.com", mockFlight);
            return;
        }

        // DB에서 가져온 모든 Flight 정보를 각 기장에게 전송
        for (Flight flight : allFlights) {
            if (flight.getPilot() == null)
                continue;

            String pilotEmail = flight.getPilot().getEmail();
            if (pilotEmail == null || pilotEmail.isBlank())
                continue;

            FlightInfoDto flightDto = FlightInfoDto.builder()
                    .flightId(flight.getId())
                    .flightNumber(flight.getFlightNumber())
                    .pilotName(flight.getPilot().getUsername())
                    .aircraftRegistrationNum(
                            flight.getAircraft() != null ? flight.getAircraft().getRegistrationNum() : "N/A")
                    .aircraftTypeCode(
                            flight.getAircraft() != null ? flight.getAircraft().getTypeCode() : "N/A")
                    .destination("N/A") // TODO: Flight에 destination 필드가 없음
                    .departureTime(
                            flight.getScheduledTime() != null
                                    ? flight.getScheduledTime().toLocalTime().toString()
                                    : "--:--")
                    .gateNode(flight.getNodeCode() != null ? flight.getNodeCode() : "N/A")
                    .assignedCarId(
                            flight.getAssignedTowingCar() != null
                                    ? flight.getAssignedTowingCar().getCode()
                                    : "N/A")
                    .build();

            towingCarWebSocketService.notifyPilotFlightInfo(pilotEmail, flightDto);
        }

        log.debug("✅ [MockScheduler] Sent DB Flight Info to {} pilots", allFlights.size());
    }
}
