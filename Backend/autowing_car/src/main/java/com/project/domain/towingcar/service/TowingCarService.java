package com.project.domain.towingcar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.mission.service.MissionWebSocketService;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.*;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.infra.mqtt.config.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;
import lombok.RequiredArgsConstructor;
import com.project.infra.websocket.service.WebSocketService;
import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarService {

    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final MissionDBAdaptor missionDBAdaptor;
    private final FlightDBAdaptor flightDBAdaptor;
    private final MapDBAdaptor mapDBAdaptor;
    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;
    private final CarWebSocketService carWebSocketService;
    private final MissionWebSocketService missionWebSocketService;

    private boolean isAutoConnectEnabled = true;
    private boolean isAutoDisconnectEnabled = true;
    private static final double ARRIVAL_THRESHOLD = 2.0;

    // =========================================================================
    // 1. 배차 & 연결 & 해제 (Dispatch / Connect / Disconnect)
    // =========================================================================

    /**
     * [배차] 기장 호출 -> 차량 배정 -> 이동 명령
     */
    @Transactional
    public void dispatchCarToFlight(String flightNumber) {
        Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNumber);
        if (flight.getAssignedTowingCar() != null)
            throw new IllegalStateException("이미 배차됨");

        TowingCar car = towingCarDBAdaptor.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE);
        flight.assignCar(car);

        // 이동 중 상태로 변경
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                car.getLastVelocity(), car.getBattery(), CarStatus.MOVING_TO_LOAD);

        log.info("🚗 [Dispatch] {} -> {}", car.getCode(), flightNumber);
        sendMqttCommand(car.getCode(), "MOVE_TO_GATE", Map.of("targetNode", flight.getNodeCode()));
    }

    /**
     * [연결] 수동/자동 공통
     */
    @Transactional
    public void connectCar(String pilotId, CarConnectRequestDto request) {
        log.info("[WS-LOG] connectCar called by {}", pilotId);
        Flight flight = flightDBAdaptor.getFlightById(request.getFlightId());
        TowingCar car = flight.getAssignedTowingCar();
        if (car == null)
            throw new IllegalStateException("차량 없음");

        if (car.getCarStatus() == CarStatus.TOWING)
            return; // 이미 연결됨

        log.info("🔗 [Connect] Flight={} (By {})", flight.getFlightNumber(), pilotId);
        sendMqttCommand(car.getCode(), "CONNECT", Map.of("flightId", flight.getId()));

        // 상태 즉시 반영 (또는 로봇 응답 대기)
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                car.getLastVelocity(), car.getBattery(), CarStatus.LOADING);

        // TODO: 추후 실제 차량(MQTT)으로부터 'CONNECTED' 응답을 받으면 그때 전송하도록 변경 필요
        // 현재는 테스트를 위해 즉시 성공 응답 전송
        log.info("[WS-LOG] Sending MOCK SUCCESS response to pilot: {}", pilotId);
        missionWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Tug Connected Successfully (Mock)")
                        .correlationId(request.getReqId())
                        .build());
    }

    /**
     * [해제] 수동/자동 공통
     */
    @Transactional
    public void disconnectCar(String pilotId, CarDisconnectRequestDto request) {
        log.info("[WS-LOG] disconnectCar called by {}", pilotId);
        Flight flight = flightDBAdaptor.getFlightById(request.getFlightId());
        TowingCar car = flight.getAssignedTowingCar();
        if (car == null)
            throw new IllegalStateException("차량 없음");

        log.info("🔌 [Disconnect] Flight={} (By {})", flight.getFlightNumber(), pilotId);
        sendMqttCommand(car.getCode(), "DISCONNECT", Map.of("flightId", flight.getId()));

        // 미션 완료 처리
        if (car.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(car.getCurrentMissionId());
            mission.updateStatus(MissionStatus.COMPLETED);
            car.clearMission();
        }

        // TODO: 추후 실제 차량(MQTT) 응답 대기 필요
        log.info("[WS-LOG] Sending MOCK SUCCESS response to pilot: {}", pilotId);
        missionWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Tug Disconnected Successfully (Mock)")
                        .correlationId(request.getReqId())
                        .build());
    }

    // =========================================================================
    // 2. 차량 제어 (Movement / Mode / Emergency)
    // =========================================================================

    /**
     * [이동 제어] MOVE / STOP
     */
    @Transactional
    public void moveCar(String pilotId, CarMoveRequestDto request) {
        log.info("[WS] Move Request: Pilot={}, Action={}, Car={}", pilotId, request.getType(), request.getCarId());

        if ("PUSHBACK".equals(request.getType())) {
            log.info("🚀 [Pushback] Approved for Flight={}, Car={}", request.getFlightId(), request.getCarId());

            // 승인 결과 알림 (Mock 데이터 포함)
            missionWebSocketService.notifyPilotResult(pilotId,
                    MissionResponseDto.builder()
                            .status("APPROVED")
                            .message("Pushback Approved to [Gate 1]")
                            .correlationId(request.getReqId())
                            .data(Map.of(
                                    "destNodeName", "Gate 1",
                                    "path", java.util.List.of("WP-001", "WP-002", "Gate-01")))
                            .build());
        } else {
            // MQTT로 차량에 직접 명령 전송
            sendMqttCommand(request.getCarId(), "MOVE_CONTROL", Map.of("action", request.getType()));

            // 결과 알림
            missionWebSocketService.notifyPilotResult(pilotId,
                    MissionResponseDto.builder()
                            .status("SUCCESS")
                            .message("Move Command Processed: " + request.getType())
                            .correlationId(request.getReqId())
                            .build());
        }
    }

    /**
     * [모드 전환] AUTO / MANUAL
     */
    @Transactional
    public void switchMode(String pilotId, CarModeRequestDto request) {
        log.info("[WS] Mode Switch: Pilot={}, Mode={}, Car={}", pilotId, request.getMode(), request.getCarId());

        // MQTT로 차량에 직접 명령 전송
        sendMqttCommand(request.getCarId(), "SET_MODE", Map.of("mode", request.getMode()));

        // 결과 알림
        missionWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("Mode Switched to: " + request.getMode())
                        .correlationId(request.getReqId())
                        .build());
    }

    /**
     * [비상 정지]
     */
    @Transactional
    public void emergencyStop(String pilotId, CarEmergencyRequestDto request) {
        log.info("[WS] EMERGENCY STOP: Pilot={}, Car={}", pilotId, request.getCarId());

        // MQTT로 차량에 직접 명령 전송
        sendMqttCommand(request.getCarId(), "EMERGENCY_STOP", Map.of());

        // 결과 알림
        missionWebSocketService.notifyPilotResult(pilotId,
                MissionResponseDto.builder()
                        .status("SUCCESS")
                        .message("EMERGENCY STOP EXECUTED")
                        .correlationId(request.getReqId())
                        .build());
    }

    // =========================================================================
    // 3. 모니터링 & 자동화 (Monitoring & Auto Trigger)
    // =========================================================================

    @Transactional
    public void processCarMonitoring(String carCode, JsonNode payload) {
        TowingCar car = towingCarDBAdaptor.getCarByCode(carCode);

        // Parse Data
        double x = payload.get("x").asDouble();
        double y = payload.get("y").asDouble();
        double heading = payload.get("yaw").asDouble();
        double velocity = payload.get("v").asDouble();
        CarStatus status = parseCarStatus(payload.path("mode").asText());
        int battery = payload.get("battery").asInt();

        // [Auto Trigger] 로봇이 멈췄을 때(IDLE) 자동 연결/해제 체크
        checkAndTriggerAutoActions(car, x, y, status);

        // DB Update & Log
        car.updateStatus(x, y, heading, velocity, battery, status);

        Mission mission = (car.getCurrentMissionId() != null)
                ? missionDBAdaptor.getMissionById(car.getCurrentMissionId())
                : null;
        saveDrivingLog(car, mission);
    }

    private void checkAndTriggerAutoActions(TowingCar car, double x, double y, CarStatus status) {
        if (status != CarStatus.IDLE)
            return;

        // Auto Connect
        if (isAutoConnectEnabled && car.getCarStatus() == CarStatus.MOVING_TO_LOAD) { // DB상 배차이동중
            Flight flight = flightDBAdaptor.getFlightByAssignedCar(car);
            if (flight != null && isArrivedAt(x, y, flight.getNodeCode())) {
                connectCar("SYSTEM", new CarConnectRequestDto(flight.getId(), null));
            }
        }

        // Auto Disconnect
        if (isAutoDisconnectEnabled && car.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(car.getCurrentMissionId());
            if (mission.getStatus() == MissionStatus.RUNNING && isArrivedAt(x, y, mission.getDestNode())) {
                disconnectCar("SYSTEM", new CarDisconnectRequestDto(mission.getFlight().getId(), null));
            }
        }
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

    private CarStatus parseCarStatus(String s) {
        try {
            return CarStatus.valueOf(s.toUpperCase());
        } catch (Exception e) {
            return CarStatus.IDLE;
        }
    }

    private void sendMqttCommand(String carCode, String cmd, Map<String, Object> data) {
        try {
            String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
            String json = objectMapper.writeValueAsString(Map.of("cmd", cmd, "data", data));
            mqttOutboundService.publish(topic, json);
        } catch (Exception e) {
            log.error("MQTT Error", e);
        }
    }
}