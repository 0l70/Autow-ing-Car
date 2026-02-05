package com.project.domain.towingcar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.user.service.UserDBAdaptor;

import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.*;
import com.project.domain.mission.dto.MissionWebSocketDtos.AdminAlertDto;
import com.project.domain.mission.dto.MissionWebSocketDtos.NotificationType; // [NEW]
import com.project.domain.map.service.MapService; // [NEW]
import java.util.List; // [NEW]
import com.project.global.util.TxUtil; // [NEW]
import com.project.domain.towingcar.mapper.TowingCarMapper; // [NEW]
import java.util.HashMap;
import java.util.UUID;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.user.entity.User;
import com.project.domain.user.service.UserDBAdaptor;
import com.project.global.error.domain.car.CarAlreadyInUseException;
import com.project.global.error.domain.car.TowingCarNotAssignedException;
import com.project.global.error.domain.flight.FlightNotFoundException;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import com.project.domain.towingcar.dto.TowingCarStatusResponse;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarService {

    private final UserDBAdaptor userDBAdaptor;
    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final MissionDBAdaptor missionDBAdaptor;
    private final FlightDBAdaptor flightDBAdaptor;
    private final MapDBAdaptor mapDBAdaptor;
    private final MapService mapService; // [NEW]
    private final TowingCarMqttService towingCarMqttService;
    private final TowingCarWebSocketService towingCarWebSocketService;
    private final TowingCarMapper towingCarMapper; // [NEW]

    // [Restored Configuration Fields]
    private final String START_NODE = "n1";
    private boolean isAutoConnectEnabled = true;
    private boolean isAutoDisconnectEnabled = true;
    private static final double ARRIVAL_THRESHOLD = 2.0;

    // ... (unchanged)
    public TowingCarStatusResponse getTowingCarStatusByPilot(String pilotId) {
        // 1. Find Pilot
        User pilot = userDBAdaptor.findUserByEmail(pilotId);

        // 2. Find Today's Flight
        Flight flight = flightDBAdaptor.findByPilotAndDepartureDate(pilot, LocalDate.now());

        if (flight == null) {
            throw new FlightNotFoundException("No active flight found for pilot today.");
        }

        // 3. Get Assigned Car
        TowingCar car = flight.getAssignedTowingCar();
        if (car == null) {
            return TowingCarStatusResponse.builder()
                    .code(null)
                    .status("NONE")
                    .build();
        }

        return towingCarMapper.toResponseDTO(car);
    }
    // ...

    @Transactional
    public void dispatchCarToFlight(String flightNumber) {
        Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNumber);
        TowingCar assignedCar = flight.getAssignedTowingCar();
        if (assignedCar == null)
            assignedCar = towingCarDBAdaptor.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE);
        else if (assignedCar.getCarStatus() != CarStatus.IDLE) {
            throw new CarAlreadyInUseException(assignedCar.getCode(), assignedCar.getCarStatus().toString());
        }
        flight.assignCar(assignedCar);

        // 이동 중 상태로 변경
        assignedCar.updateStatus(assignedCar.getLastPosX(), assignedCar.getLastPosY(), assignedCar.getLastHeading(),
                assignedCar.getLastVelocity(), assignedCar.getBattery(), CarStatus.MOVING_TO_LOAD);

        log.info("🚗 [Dispatch] {} -> {}", assignedCar.getCode(), flightNumber);

        // ✅ 알림: WebSocket (Helper 메서드로 위임)
        notifyCarDispatched(assignedCar, flight);

        // ✅ MQTT: 트랜잭션 커밋 후 전송
        final String carCode = assignedCar.getCode();
        final String nodeCode = flight.getNodeCode(); // Target Gate

        // [New Logic] Calculate Path on Server
        Node carNode = mapDBAdaptor.getNodeByCode(START_NODE); // Default Origin
        Node gateNode = mapDBAdaptor.getNodeByCode(nodeCode);

        List<Edge> path = mapService.findOptimalPath(carNode, gateNode);
        // List<Map<String, Object>> pathPayload =
        // mapService.convertPathToPayload(path); // Removed

        // Define Payload (Standardized Format)
        Map<String, Object> data = new HashMap<>();
        data.put("carId", carCode);
        data.put("startNode", START_NODE);
        data.put("endNode", nodeCode);
        data.put("edgeIds", path.stream().map(Edge::getEdgeCode).toList());
        data.put("finalAction", "DOCK");

        Map<String, Object> payload = new HashMap<>(); // [FIX] Use import
        payload.put("msgId", UUID.randomUUID().toString());
        payload.put("timestamp", System.currentTimeMillis());
        payload.put("type", "DRIVE");
        payload.put("taskId", "DISPATCH_" + flight.getId());
        payload.put("data", data);

        TxUtil.executeAfterCommit(() -> towingCarMqttService.sendDriveCommand(carCode, payload));
    }

    /**
     * [연결] 수동/자동 공통
     */
    @Transactional
    public void connectCar(String pilotId, CarConnectRequestDto request) {
        Flight flight = flightDBAdaptor.getFlightById(request.getFlightId());
        TowingCar assignedCar = flight.getAssignedTowingCar();
        if (assignedCar == null)
            throw new TowingCarNotAssignedException(flight.getFlightNumber());

        if (assignedCar.getCarStatus() == CarStatus.TOWING)
            return; // 이미 연결됨

        log.info("🔗 [Connect] Flight={} (By {})", flight.getFlightNumber(), pilotId);

        // ✅ 비즈니스 로직: 상태 변경만
        assignedCar.updateStatus(assignedCar.getLastPosX(), assignedCar.getLastPosY(),
                assignedCar.getLastHeading(), assignedCar.getLastVelocity(),
                assignedCar.getBattery(), CarStatus.LOADING);

        // ✅ 알림: WebSocket (Helper 메서드로 위임)
        notifyCarConnected(assignedCar, pilotId);

        // ✅ MQTT: 트랜잭션 커밋 후 전송
        final String carCode = assignedCar.getCode();
        final Long flightId = flight.getId();
        TxUtil.executeAfterCommit(() -> towingCarMqttService.connectCar(carCode, flightId));
    }

    /**
     * [해제] 수동/자동 공통
     */
    @Transactional
    public void disconnectCar(String pilotId, CarDisconnectRequestDto request) {
        Flight flight = flightDBAdaptor.getFlightById(request.getFlightId());
        TowingCar assignedCar = flight.getAssignedTowingCar();
        if (assignedCar == null)
            throw new TowingCarNotAssignedException(flight.getFlightNumber());

        log.info("🔌 [Disconnect] Flight={} (By {})", flight.getFlightNumber(), pilotId);

        // 1. 상태 변경: UNLOADING
        assignedCar.updateStatus(assignedCar.getLastPosX(), assignedCar.getLastPosY(),
                assignedCar.getLastHeading(), assignedCar.getLastVelocity(),
                assignedCar.getBattery(), CarStatus.UNLOADING);
        towingCarDBAdaptor.save(assignedCar); // Intermediate save

        // 2. 미션 완료 처리
        if (assignedCar.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(assignedCar.getCurrentMissionId());
            mission.updateStatus(MissionStatus.COMPLETED);
            assignedCar.clearMission();
        }

        // 3. 차고지 복귀 (Return to Base) -> MQTT 전송 & 상태 변경 (MOVING_TO_IDLE)
        returnToBase(assignedCar);

        log.info("✅ [Disconnect] Car {} returning to base (MOVING_TO_IDLE)", assignedCar.getCode());

        // ✅ 알림: WebSocket (Helper 메서드로 위임)
        notifyCarDisconnected(assignedCar, pilotId);

        // ✅ MQTT: Disconnect 명령을 따로 보낼 필요가 있는지 체크 (이미 Return Path를 보냄)
        // 만약 Disconnect라는 Action이 별도로 필요하다면 유지, 아니면 PARK 명령으로 대체됨.
        // 기장님 요청: "경로가 주어지고 도착 시 UNLOADING -> 차고지로 돌아가기 -> IDLE"
        // 즉, 별도의 Disconnect Control 명령보다는 Drive 명령이 중요함.
        // 하지만 기존 호환성을 위해 Disconnect Control 메시지도 전송 (Optional)
        final String carCode = assignedCar.getCode();
        final Long flightId = flight.getId();
        TxUtil.executeAfterCommit(() -> towingCarMqttService.disconnectCar(carCode, flightId));
    }

    private void returnToBase(TowingCar car) {
        // 1. Find Base Node
        // "base_node" 혹은 적절한 IDLE 노드 찾기
        // Node baseNode = mapDBAdaptor.getNodeByCode("base_node");
        // [Fallback] 만약 base_node가 없다면, 현재 위치에서 가장 가까운 IDLE 노드 혹은 그냥 멈춤
        // Node baseNode = mapService.findNearestNode(car.getLastPosX(),
        // car.getLastPosY()); // 임시

        Node baseNode = mapDBAdaptor.getNodeByCode("S01");
        if (baseNode == null) {
            baseNode = mapService.findNearestNode(0, 0); // Default Origin
        }

        Node carNode = mapService.findNearestNode(car.getLastPosX(), car.getLastPosY());
        if (carNode == null)
            carNode = baseNode;

        // 2. Calculate Path
        List<Edge> path = mapService.findOptimalPath(carNode, baseNode);
        // List<Map<String, Object>> pathPayload =
        // mapService.convertPathToPayload(path);

        // 3. Construct Payload
        Map<String, Object> data = new HashMap<>();
        data.put("carId", car.getCode());
        data.put("startNode", carNode.getNodeCode());
        data.put("endNode", baseNode.getNodeCode());
        data.put("edgeIds", path.stream().map(Edge::getEdgeCode).toList());
        data.put("finalAction", "PARK"); // 도착 시 IDLE로 전환

        Map<String, Object> payload = new HashMap<>();
        payload.put("msgId", UUID.randomUUID().toString());
        payload.put("timestamp", System.currentTimeMillis());
        payload.put("type", "DRIVE");
        payload.put("taskId", "RETURN_" + car.getCode());
        payload.put("data", data);

        // 4. Send MQTT
        TxUtil.executeAfterCommit(() -> towingCarMqttService.sendDriveCommand(car.getCode(), payload));

        // 5. Update Status
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                car.getLastVelocity(), car.getBattery(), CarStatus.MOVING_TO_IDLE);
        towingCarDBAdaptor.save(car);
    }

    // =========================================================================
    // 2. 모니터링 & 자동화 (Monitoring & Auto Trigger)
    // =========================================================================

    @Transactional
    public void processCarMonitoring(String carCode, JsonNode payload) {
        TowingCar assignedCar = towingCarDBAdaptor.getCarByCode(carCode);

        // Parse Data
        double x = payload.get("x").asDouble();
        double y = payload.get("y").asDouble();
        double heading = payload.get("yaw").asDouble();
        double velocity = payload.get("v").asDouble();
        CarStatus status = CarStatus.from(payload.path("mode").asText());
        int battery = payload.get("battery").asInt();

        // [Auto Trigger] 로봇이 멈췄을 때(IDLE) 자동 연결/해제 체크
        checkAndTriggerAutoActions(assignedCar, x, y, status);

        // DB Update & Log
        // DB Update & Log
        CarStatus oldStatus = assignedCar.getCarStatus(); // Check previous status
        assignedCar.updateStatus(x, y, heading, velocity, battery, status);

        // [New Logic] 1-4. 토잉카가 토잉 완료(TOWING) 상태를 보냈을 때 -> 기장에게 즉시 알림
        if (oldStatus != CarStatus.TOWING && status == CarStatus.TOWING) {
            log.info("🎉 [Monitoring] Car {} reported TOWING complete!", carCode);
            Flight flight = flightDBAdaptor.getFlightByAssignedCar(assignedCar);
            if (flight != null) {
                notifyTowingComplete(assignedCar, flight.getPilot().getEmail());
            }
        }

        Mission mission = (assignedCar.getCurrentMissionId() != null)
                ? missionDBAdaptor.getMissionById(assignedCar.getCurrentMissionId())
                : null;

        // [Status Tracking] Car status -> Mission status sync
        if (mission != null && mission.getStatus() == MissionStatus.RUNNING) {
            if (status == CarStatus.STOP) {
                mission.updateStatus(MissionStatus.PAUSED);
                missionDBAdaptor.save(mission);
                log.warn("⚠️ [Monitoring] Car {} STOPPED -> Mission {} PAUSED", carCode, mission.getId());
                // Notify?
            } else if (status == CarStatus.ERROR) {
                // handle error...
            }
        }

        saveDrivingLog(assignedCar, mission);

        // [Final Step] 통합 브로드캐스트 (DTO 기반으로 Pilot + ATCs에게 전송)
        towingCarWebSocketService.broadcastCarStatus(carCode, towingCarMapper.toDTO(assignedCar));
    }

    private void checkAndTriggerAutoActions(TowingCar assignedCar, double x, double y, CarStatus status) {
        // [Fix] Allow checking auto actions even if status is not IDLE (e.g.
        // MOVING_TO_LOAD)
        // if (status != CarStatus.IDLE) return;

        // Auto Connect
        if (isAutoConnectEnabled && assignedCar.getCarStatus() == CarStatus.MOVING_TO_LOAD) { // DB상 배차이동중
            Flight flight = flightDBAdaptor.getFlightByAssignedCar(assignedCar);
            if (flight != null && isArrivedAt(x, y, flight.getNodeCode())) {
                connectCar("SYSTEM", new CarConnectRequestDto(flight.getId()));
            }
        }

        // Auto Disconnect
        if (isAutoDisconnectEnabled && assignedCar.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(assignedCar.getCurrentMissionId());
            if (mission.getStatus() == MissionStatus.RUNNING && isArrivedAt(x, y, mission.getDestNode())) {
                disconnectCar("SYSTEM", new CarDisconnectRequestDto(mission.getFlight().getId()));
            }
        }
    }

    /**
     * [모드 전환] AUTO / MANUAL
     */
    @Transactional
    public void switchMode(String pilotId, CarModeRequestDto request) {
        log.info("[WS] Mode Switch: Pilot={}, Mode={}, Car={}", pilotId, request.getMode(), request.getCar_code());

        // ✅ 알림 (Helper)
        notifyModeSwitched(pilotId, request.getMode());

        // ✅ MQTT (커밋 후)
        final String carCode = request.getCar_code();
        final String mode = request.getMode();
        TxUtil.executeAfterCommit(() -> towingCarMqttService.setMode(carCode, mode));
    }

    /**
     * [비상 정지]
     */
    @Transactional
    public void emergencyStop(String pilotId, CarEmergencyRequestDto request) {
        log.info("[WS] EMERGENCY STOP: Pilot={}, Car={}", pilotId, request.getCarId());

        final String carCode = request.getCarId();

        // [NEW] Mission 상태를 PAUSED로 변경
        missionDBAdaptor.findByCarCodeAndStatus(carCode, MissionStatus.RUNNING)
                .ifPresent(mission -> {
                    mission.updateStatus(MissionStatus.PAUSED);
                    missionDBAdaptor.save(mission);
                    log.info("[Mission] Status changed to PAUSED: missionId={}", mission.getId());
                });

        // 1. MQTT (커밋 후 전송 - 즉시 정지)
        TxUtil.executeAfterCommit(() -> towingCarMqttService.emergencyStop(carCode));

        // 2. 알림 (Helper) - 관제사에게 알림 추가
        notifyEmergencyStop(pilotId, request.getCarId());
    }

    /**
     * [NEW] 푸시백 재개
     */
    @Transactional
    public void resumePushback(String pilotId, CarEmergencyRequestDto request) {
        String carCode = request.getCarId();
        log.info("[WS] RESUME PUSHBACK: Pilot={}, Car={}", pilotId, carCode);

        // 1. PAUSED 상태의 Mission 찾기
        Mission mission = missionDBAdaptor.findByCarCodeAndStatus(carCode, MissionStatus.PAUSED)
                .orElseThrow(() -> new IllegalStateException("No paused mission for car: " + carCode));

        // 2. Mission 상태를 RUNNING으로 변경
        mission.updateStatus(MissionStatus.RUNNING);
        missionDBAdaptor.save(mission);

        // 3. MQTT 재개 명령
        TxUtil.executeAfterCommit(() -> towingCarMqttService.resumeCar(carCode));

        log.info("[Mission] Resumed: missionId={}", mission.getId());
    }

    // =========================================================================
    // Helpers
    // =========================================================================
    private boolean isArrivedAt(double curX, double curY, String nodeCode) {
        Node node = mapDBAdaptor.getNodeByCode(nodeCode);
        if (node == null)
            return false;
        double dx = curX - node.getPosX();
        double dy = curY - node.getPosY();
        return (dx * dx + dy * dy) <= (ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD);
    }

    private void saveDrivingLog(TowingCar car, Mission mission) {
        DrivingLog log = DrivingLog.builder()
                .towingCarId(car.getId())
                .missionId(mission != null ? mission.getId() : null)
                .carStatus(car.getCarStatus())
                .missionStatus(mission != null ? mission.getStatus() : MissionStatus.RUNNING)
                .posX(car.getLastPosX()).posY(car.getLastPosY())
                .heading(car.getLastHeading()).velocity(car.getLastVelocity()).battery(car.getBattery())
                .build();
        towingCarDBAdaptor.saveDrivingLog(log);
    }

    // toResponseDTO, toDTO, parseCarStatus and sendMqttAfterCommit are removed

    /**
     * 배차 완료 알림
     */
    /**
     * 배차 완료 알림
     */
    private void notifyCarDispatched(TowingCar car, Flight flight) {
        towingCarWebSocketService.broadcastCarStatus(car.getCode(), towingCarMapper.toDTO(car));
        towingCarWebSocketService.notifyFlightChannel(flight.getId(),
                Map.of("event", "CAR_DISPATCHED", "carCode", car.getCode()));
    }

    /**
     * 연결 완료 알림
     */
    private void notifyCarConnected(TowingCar car, String pilotId) {
        towingCarWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Connecting Initiated...")
                        .build());
    }

    /**
     * 연결 해제 알림
     */
    private void notifyCarDisconnected(TowingCar car, String pilotId) {
        towingCarWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Disconnected Successfully")
                        .build());
    }

    /**
     * 모드 전환 결과 알림
     */
    private void notifyModeSwitched(String pilotId, String mode) {
        towingCarWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("mode_switched")
                        .message("Mode Switched to: " + mode)
                        .build());
    }

    /**
     * 비상 정지 결과 알림
     */
    private void notifyEmergencyStop(String pilotId, String carCode) {
        // 1. Pilot에게 알림
        towingCarWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("emergency_stop")
                        .message("EMERGENCY STOP EXECUTED")
                        .build());

        // 2. 관제사(Admin)에게 알림
        // AdminAlertDto 생성
        AdminAlertDto alert = AdminAlertDto.builder()
                .type(NotificationType.EMERGENCY_STOP) // [FIX] Use Enum
                .message("Pilot triggered EMERGENCY STOP for Car " + carCode)
                .severity("emergency_stop")
                .flightNumber("N/A") // 필요 시 Flight 조회하여 채움
                .timestamp(System.currentTimeMillis())
                .build();

        towingCarWebSocketService.notifyAdminEmergency(alert);
    }

    /**
     * 토잉 완료(연결 완료) 알림
     */
    private void notifyTowingComplete(TowingCar car, String pilotId) {
        towingCarWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Towing Connected (Ready for Mission)")
                        .build());
    }

    @Transactional(readOnly = true)
    public List<TowingCarStatusResponse> getAllTowingCars() {
        return towingCarDBAdaptor.findAllCars().stream()
                .map(towingCarMapper::toResponseDTO)
                .collect(java.util.stream.Collectors.toList());
    }
}