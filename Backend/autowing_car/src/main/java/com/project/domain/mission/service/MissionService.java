package com.project.domain.mission.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.LogType;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.infra.mqtt.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionDBAdaptor missionDBAdaptor;
    private final TowingCarDBAdaptor towingCarReader;
    private final FlightDBAdaptor flightDBAdaptor;

    private final WebSocketService webSocketService;
    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;

    // =========================================================================
    // Phase 1. 차량 호출 및 연결 (Dispatch & Connection) - 미션 생성 X
    // =========================================================================

    /**
     * 기장이 "차량 호출" 버튼을 눌렀을 때 실행.
     * 미션을 만들지 않고, Flight에 차량을 배정(Assign)하고 로봇을 부른다.
     */
    @Transactional
    public void dispatchCarToFlight(String flightNumber) {
        Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNumber);

        // 1. 이미 배정된 차가 있는지 확인
        if (flight.getAssignedTowingCar() != null) {
            throw new IllegalStateException("이미 배정된 차량이 있습니다: " + flight.getAssignedTowingCar().getCode());
        }

        // 2. 가용 차량(IDLE) 찾기 (배터리 많은 순)
        TowingCar car = towingCarReader.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE);

        // 3. 항공편에 차량 예약 (DB 업데이트)
        flight.setAssignedTowingCar(car); // Flight 엔티티에 setAssignedTowingCar(car)

        // 4. 차량 상태 변경 (이동 중)
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                car.getLastVelocity(), car.getBattery(), CarStatus.MOVING); // 아직 Mission ID는 없음
        log.info("🚗 [배차 완료] Flight={} <-> Car={}", flightNumber, car.getCode());

        // 5. 로봇에게 "게이트로 이동하라" 명령 전송
        sendMqttAfterCommit(car.getCode(), "MOVE_TO_GATE", Map.of(
                "targetNode", flight.getGateNumber(),
                "flightNumber", flightNumber));
    }

    // =========================================================================
    // Phase 2. 운송 미션 생성 및 시작 (Mission Creation & Transport) - 미션 생성 O
    // =========================================================================

    /**
     * 차량이 도착하고 물리적 연결(Connect)이 완료된 후,
     * 기장이 "운송 시작(Go to Runway)"을 요청했을 때 실행.
     */
    @Transactional(readOnly = true)
    public void requestTransport(String pilotId, PilotRequestDto request) {
        Flight flight = flightDBAdaptor.getFlightByFlightNumber(request.getFlightNumber());

        // 1. 사전 조건 검사: 차량이 배정되어 있어야 함
        TowingCar car = flight.getAssignedTowingCar(); // Flight 엔티티에 추가했던 getter
        if (car == null) {
            throw new IllegalStateException("배정된 차량이 없습니다. 먼저 차량을 호출하세요.");
        }

        // 2. 이미 진행 중인 미션이 있는지 검사
        // boolean hasActiveMission = missionDBAdaptor.existsByFlightAndStatusIn(flight,
        // List.of(MissionStatus.RUNNING, MissionStatus.RUNNING, MissionStatus.PAUSED));
        // if (hasActiveMission) {
        // throw new IllegalStateException("이미 진행 중인 미션이 있습니다.");
        // }
        // 3. 경로 추천 로직 (Mockup: 실제로는 알고리즘으로 계산해야 함)
        List<PathOptionDto> pathOptions = calculatePathOptions(request.getDepartNode(), request.getDestNode());

        // 3. 관제사에게 승인 요청 (알림 전송)
        AdminAlertDto alert = AdminAlertDto.builder().flightNumber(flight.getFlightNumber()) // ★ 식별자 역할
                .flightNumber(flight.getFlightNumber()) // ★ 식별자 역할
                .pilotId(flight.getPilot().getUsername())
                .departNode(request.getDepartNode())
                .destNode(request.getDestNode())
                .pathOptions(pathOptions) // ★ 추천 경로 포함
                .build();
        notifyAdminForApproval(alert);

        log.info("✈️ [운송 요청] Pilot={} Flight={} Car={}", pilotId, flight.getFlightNumber(), car.getCode());
    }

    /**
     * 관제사가 "승인(Approve)"을 눌렀을 때 실행.
     * 실제 로봇이 항공기를 끌고 움직이기 시작함.
     */
    @Transactional
    public void approveMission(String controllerId, ATCDecisionDto decision) {

        String flightNum = decision.getFlightNumber();
        Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNum);

        // 1. 거절(Reject) 처리 - 미션 생성 안 함
        if (!decision.isApproved()) {
            webSocketService.notifyPilotResult(flight.getPilot().getUsername(),
                    MissionResponseDto.builder()
                            .status("REJECTED")
                            .message(decision.getRejectReason())
                            .build());
            return;
        }

        // 2. ★ 미션 엔티티 생성 (상태: RUNNING)
        TowingCar car = flight.getAssignedTowingCar();

        Mission mission = Mission.builder()
                .pilot(flight.getPilot())
                .flight(flight)
                .towingCar(car)
                .status(MissionStatus.RUNNING) // ★ 승인 즉시 RUNNING
                .departNode(flight.getGateNumber()) // 마지막 노드는 추후 구현
                .routeEdgeIds(decision.getSelectedEdgeIds()) // ★ 관제사가 선택한 경로 저장
                .build();

        Mission savedMission = missionDBAdaptor.save(mission);

        // 3. 차량 상태 업데이트 (미션 매핑)
        car.assignMission(savedMission.getId());

        // 4. 로그 기록
        missionDBAdaptor.saveLog(savedMission, LogType.APPROVE,
                "Created & Approved by " + controllerId);

        // 5. 알림 전송 (기장 및 관제사 화면 업데이트)
        notifyMissionUpdate(savedMission);

        // 6. 로봇에게 "운송 시작" 명령 전송
        sendMqttAfterCommit(car.getCode(), "START_TRANSPORT", Map.of(
                "path", decision.getSelectedEdgeIds(),
                "missionId", savedMission.getId(),
                "destNode", savedMission.getDestNode()));

        log.info("✅ [미션 시작] Mission Created & Started: ID={}", savedMission.getId());
    }

    // =========================================================================
    // Phase 3. 제어 (Control)
    // =========================================================================

    /**
     * 기장/관제사가 비상 정지(STOP) 등을 눌렀을 때
     */
    public void controlMission(String userId, PilotControlDto controlDto) {
        Mission mission = missionDBAdaptor.getMissionById(controlDto.getMissionId());

        String cmd = controlDto.getCommand(); // "STOP", "RESUME"
        missionDBAdaptor.saveLog(mission, LogType.CONTROL, userId + ": " + cmd);

        // 즉시 전송
        sendMqttImmediate(mission.getTowingCar().getCode(), cmd, Map.of());

        // DB 상태 업데이트 (옵션)
        if ("STOP".equals(cmd))
            mission.updateStatus(MissionStatus.PAUSED);
        if ("RESUME".equals(cmd))
            mission.updateStatus(MissionStatus.RUNNING);
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================
    private void notifyAdminForApproval(AdminAlertDto alert) {
        // 관제사에게 보낼 데이터 구성 (이전 코드 활용)
        // ... (availableCars, pathOptions 등 로직)
        webSocketService.notifyAdminRequest(alert);
    }

    private void handleMissionRejection(Mission mission, String controllerId, String reason) {
        mission.updateStatus(MissionStatus.REJECTED);
        missionDBAdaptor.saveLog(mission, LogType.REJECT, reason);
        webSocketService.notifyPilotResult(mission.getPilot().getUsername(), MissionResponseDto.from(mission));
    }

    private void notifyMissionUpdate(Mission mission) {
        MissionResponseDto response = MissionResponseDto.from(mission);
        if (mission.getPilot() != null)
            webSocketService.notifyPilotResult(mission.getPilot().getUsername(), response);
        webSocketService.broadcastMissionUpdate(response);
    }

    private void sendMqttAfterCommit(String carCode, String cmd, Map<String, Object> data) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                sendMqttImmediate(carCode, cmd, data);
            }
        });
    }

    private void sendMqttImmediate(String carCode, String cmd, Map<String, Object> data) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("cmd", cmd);
            payload.put("timestamp", System.currentTimeMillis());
            if (data != null)
                payload.put("data", data);

            String json = objectMapper.writeValueAsString(payload);
            String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
            mqttOutboundService.publish(topic, json);
            log.info("📡 MQTT Sent: {}", json);
        } catch (Exception e) {
            log.error("MQTT Error", e);
        }
    }

    private List<PathOptionDto> calculatePathOptions(String start, String end) {
        // 실제로는 GraphService 등을 호출해야 함
        return List.of(
                PathOptionDto.builder()
                        .optionId(1L)
                        .label("최단 경로 (Recommended)")
                        .edgeIds(List.of("E1", "E2", "E3", "E4"))
                        .build(),
                PathOptionDto.builder()
                        .optionId(2L)
                        .label("우회 경로 (Safety)")
                        .edgeIds(List.of("E1", "E5", "E6", "E3"))
                        .build());
    }

}