package com.project.domain.towingcar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.user.service.UserDBAdaptor;
import com.project.domain.flight.service.FlightService;
import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.*;
import com.project.domain.mission.dto.MissionWebSocketDtos.AdminAlertDto;
import com.project.domain.mission.dto.MissionWebSocketDtos.NotificationType; // [NEW]
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
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
    private final TowingCarMqttService towingCarMqttService;
    private final TowingCarWebSocketService towingCarWebSocketService;
    private final FlightService flightService; // [RESTORED]

    // [Restored Configuration Fields]
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

        return toResponseDTO(car);
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
        final String nodeCode = flight.getNodeCode();
        sendMqttAfterCommit(() -> towingCarMqttService.moveCarToGate(carCode, nodeCode));

        // ✅ 비동기 시뮬레이션: 트랜잭션 커밋 후 시작
        final Long flightId = flight.getId();
        sendMqttAfterCommit(() -> simulateAutoConnection(carCode, flightId));
    }

    private void simulateAutoConnection(String carCode, Long flightId) {
        CompletableFuture.runAsync(() -> {
            try {
                // Wait 3 seconds (car "travels" to gate)
                TimeUnit.SECONDS.sleep(3);

                log.info("[TEST] {} arrived at gate, triggering connect...", carCode);

                // Trigger connect (sets LOADING status)
                TowingCar car = towingCarDBAdaptor.getCarByCode(carCode);
                Flight flight = flightDBAdaptor.getFlightById(flightId);

                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                        car.getLastVelocity(), car.getBattery(), CarStatus.LOADING);
                towingCarDBAdaptor.save(car); // [FIX] DB Sync
                towingCarWebSocketService.broadcastCarStatus(carCode, toDTO(car));

                // Wait another 3 seconds (loading process)
                TimeUnit.SECONDS.sleep(3);

                log.info("[TEST] {} loading complete, Connected (TOWING)", carCode);

                // Set TOWING status
                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                        car.getLastVelocity(), car.getBattery(), CarStatus.TOWING);
                towingCarDBAdaptor.save(car); // [FIX] DB Sync
                towingCarWebSocketService.broadcastCarStatus(carCode, toDTO(car));

            } catch (InterruptedException e) {
                log.error("[TEST] Auto-connection simulation interrupted", e);
            }
        });
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
        sendMqttAfterCommit(() -> towingCarMqttService.connectCar(carCode, flightId));
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

        // ✅ 비즈니스 로직: 상태 변경과 미션 종료
        assignedCar.updateStatus(assignedCar.getLastPosX(), assignedCar.getLastPosY(),
                assignedCar.getLastHeading(), assignedCar.getLastVelocity(),
                assignedCar.getBattery(), CarStatus.UNLOADING);

        // 미션 완료 처리
        if (assignedCar.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(assignedCar.getCurrentMissionId());
            mission.updateStatus(MissionStatus.COMPLETED);
            assignedCar.clearMission();
        }

        // ✅ 알림: WebSocket (Helper 메서드로 위임)
        notifyCarDisconnected(assignedCar, pilotId);

        // ✅ MQTT: 트랜잭션 커밋 후 전송
        final String carCode = assignedCar.getCode();
        final Long flightId = flight.getId();
        sendMqttAfterCommit(() -> towingCarMqttService.disconnectCar(carCode, flightId));
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
        CarStatus status = parseCarStatus(payload.path("mode").asText());
        int battery = payload.get("battery").asInt();

        // [Auto Trigger] 로봇이 멈췄을 때(IDLE) 자동 연결/해제 체크
        checkAndTriggerAutoActions(assignedCar, x, y, status);

        // DB Update & Log
        assignedCar.updateStatus(x, y, heading, velocity, battery, status);

        Mission mission = (assignedCar.getCurrentMissionId() != null)
                ? missionDBAdaptor.getMissionById(assignedCar.getCurrentMissionId())
                : null;
        saveDrivingLog(assignedCar, mission);
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
        sendMqttAfterCommit(() -> towingCarMqttService.setMode(carCode, mode));
    }

    /**
     * [비상 정지]
     */
    @Transactional
    public void emergencyStop(String pilotId, CarEmergencyRequestDto request) {
        log.info("[WS] EMERGENCY STOP: Pilot={}, Car={}", pilotId, request.getCarId());

        // 1. MQTT (커밋 후 전송 - 즉시 정지)
        final String carCode = request.getCarId();
        sendMqttAfterCommit(() -> towingCarMqttService.emergencyStop(carCode));

        // 2. 알림 (Helper) - 관제사에게 알림 추가
        notifyEmergencyStop(pilotId, request.getCarId());
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
                .missionStatus(mission != null ? mission.getStatus() : MissionStatus.WAITING)
                .posX(car.getLastPosX()).posY(car.getLastPosY())
                .heading(car.getLastHeading()).velocity(car.getLastVelocity()).battery(car.getBattery())
                .build();
        towingCarDBAdaptor.saveDrivingLog(log);
    }

    private TowingCarStatusResponse toResponseDTO(TowingCar car) {
        return TowingCarStatusResponse.builder()
                .code(car.getCode())
                .posX(car.getLastPosX() != null ? car.getLastPosX() : 0.0)
                .posY(car.getLastPosY() != null ? car.getLastPosY() : 0.0)
                .heading(car.getLastHeading() != null ? car.getLastHeading() : 0.0)
                .velocity(car.getLastVelocity() != null ? car.getLastVelocity() : 0.0)
                .battery(car.getBattery())
                .status(car.getCarStatus().name())
                .build();
    }

    private TowingCarDTO toDTO(TowingCar car) {
        return TowingCarDTO.builder()
                .code(car.getCode())
                .posX(car.getLastPosX() != null ? car.getLastPosX() : 0.0)
                .posY(car.getLastPosY() != null ? car.getLastPosY() : 0.0)
                .heading(car.getLastHeading() != null ? car.getLastHeading() : 0.0)
                .velocity(car.getLastVelocity() != null ? car.getLastVelocity() : 0.0)
                .battery(car.getBattery())
                .status(car.getCarStatus().name())
                .build();
    }

    private CarStatus parseCarStatus(String s) {
        try {
            return CarStatus.valueOf(s.toUpperCase());
        } catch (Exception e) {
            return CarStatus.IDLE;
        }
    }

    // =========================================================================
    // Helper Methods (Notification & MQTT-After-Commit)
    // =========================================================================

    /**
     * TransactionSynchronization을 사용하여 트랜잭션 커밋 후 MQTT 명령 전송
     * MissionService 패턴 적용
     */
    private void sendMqttAfterCommit(Runnable mqttCommand) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            mqttCommand.run();
                        }
                    });
        } else {
            mqttCommand.run();
        }
    }

    /**
     * 배차 완료 알림
     */
    private void notifyCarDispatched(TowingCar car, Flight flight) {
        towingCarWebSocketService.broadcastCarStatus(car.getCode(), toDTO(car));
        towingCarWebSocketService.notifyFlightChannel(flight.getId(),
                Map.of("event", "CAR_DISPATCHED", "carCode", car.getCode()));
    }

    /**
     * 연결 완료 알림
     */
    private void notifyCarConnected(TowingCar car, String pilotId) {
        towingCarWebSocketService.broadcastCarStatus(car.getCode(), toDTO(car));
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
        towingCarWebSocketService.broadcastCarStatus(car.getCode(), toDTO(car));
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
                        .status("SUCCESS")
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
                        .status("SUCCESS")
                        .message("EMERGENCY STOP EXECUTED")
                        .build());

        // 2. 관제사(Admin)에게 알림
        // AdminAlertDto 생성
        AdminAlertDto alert = AdminAlertDto.builder()
                .type(NotificationType.EMERGENCY_STOP) // [FIX] Use Enum
                .message("Pilot triggered EMERGENCY STOP for Car " + carCode)
                .severity("CRITICAL")
                .flightNumber("N/A") // 필요 시 Flight 조회하여 채움
                .timestamp(System.currentTimeMillis())
                .build();

        towingCarWebSocketService.notifyAdminEmergency(alert);
    }
}