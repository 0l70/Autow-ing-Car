package com.project.domain.mission.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.LogType;
import com.project.domain.common.MissionStatus;
import com.project.domain.common.MissionType;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.entity.MissionLog;
import com.project.domain.mission.repository.MissionLogRepository;
import com.project.domain.mission.repository.MissionRepository;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository;
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
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionRepository missionRepository;
    private final MissionLogRepository missionLogRepository;
    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    
    private final WebSocketService webSocketService;
    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;

    /**
     * 1. [기장 요청] 미션 생성 및 타입별 분기 처리
     * - TOWING: 자동 배차 및 즉시 출발
     * - TRANSPORT: 관제사 승인 대기
     */
    @Transactional
    public void createMissionRequest(String pilotId, PilotRequestDto request) {
        log.info("📢 기장 요청 수신: Pilot={}, Type={}, Route={}->{}", 
                pilotId, request.getMissionType(), request.getDepartNode(), request.getDestNode());

        // 1. 데이터 검증 및 조회
        MissionType type = resolveMissionType(request.getMissionType());
        Flight flight = resolveFlight(request.getFlightNumber());

        // [수정] 항공편에 이미 배정된 토잉카를 가져옴 (1:1 매칭 전제)
        TowingCar assignedCar = flight != null ? flight.getTowingCar() : null;

        // 2. 미션 엔티티 생성 및 저장 (ID 생성)
        Mission mission = Mission.builder()
                .pilotId(pilotId)
                .flight(flight)
                .towingCar(assignedCar) // 미션 생성 시점에 차량 확정
                .type(type)
                .departNode(request.getDepartNode())
                .destNode(request.getDestNode())
                .status(MissionStatus.WAITING)
                .build();
        
        Mission savedMission = missionRepository.save(mission);
        saveLog(savedMission, LogType.REQUEST, String.format("Requested: %s (Flight: %s)", type, request.getFlightNumber()));

        // 3. 로직 분기
        if (type == MissionType.TOWING) {
            processDirectTowing(savedMission);
        } else {
            processTransportRequest(savedMission);
        }
    }

    /**
     * 2. [관제사 승인] 결정 -> 배차 -> 알림 -> 명령 전송
     */
    @Transactional
    public void approveMission(String controllerId, ATCDecisionDto decision) {
        Mission mission = getMissionOrThrow(decision.getMissionId());

        // A. 반려(Reject) 처리
        if (!decision.isApproved()) {
            handleMissionRejection(mission, controllerId, decision.getRejectReason());
            return;
        }

        // B. 승인(Approve) 처리
        handleMissionApproval(mission, controllerId, decision);
    }

    /**
     * 3. [기장/관제사 제어] 비상 정지/재개 등
     */
    public void controlMission(String userId, PilotControlDto controlDto) {
        Mission mission = getMissionOrThrow(controlDto.getMissionId());
        validateCarAssigned(mission);

        String cmd = controlDto.getCommand(); // "PAUSE", "RESUME", "STOP"
        
        // 로그 기록
        saveLog(mission, LogType.CONTROL, String.format("Control by %s: %s", userId, cmd));

        // 즉시 전송 (긴급 제어는 Transaction 대기 없이 즉시 실행 권장)
        sendMqttImmediate(mission.getTowingCar().getCode(), cmd, Map.of());
    }

    // =================================================================================
    // Private Logic Methods (분리된 로직들)
    // =================================================================================

    /**
     * [Logic] 토잉 요청: 자동 배차 및 즉시 실행
     */
    private void processDirectTowing(Mission mission) {
        // 1. 배차 확인 (이미 Flight를 통해 배정되어 있어야 함)
        TowingCar car = mission.getTowingCar();
        if (car == null) {
            throw new IllegalStateException("항공편에 배정된 토잉카가 없습니다.");
        }

        // 2. 상태 업데이트
        assignCarToMission(mission, car, new ArrayList<>()); // 경로는 로봇 자율 or 추후 계산
        
        saveLog(mission, LogType.DISPATCH, "Auto-Dispatch: Car " + car.getCode());

        // 3. 알림 및 명령
        notifyMissionUpdate(mission);
        
        // "기장이 있는 곳으로 이동하라" 명령 전송
        sendMqttAfterCommit(car.getCode(), "MOVE_TO_PICKUP", Map.of(
            "target", mission.getDepartNode(),
            "missionId", mission.getId()
        ));
        
        log.info("🚀 [토잉] 자동 배차 완료: MissionID={}, Car={}", mission.getId(), car.getCode());
    }

    /**
     * [Logic] 운반 요청: 관제사 호출
     */
    private void processTransportRequest(Mission mission) {
        // 1. 관제사에게 보여줄 추천 데이터 구성
        List<AvailableCarDto> availableCars;
        
        // [수정] 이미 차량이 배정된 경우, 해당 차량 정보만 리스트에 담아 전송
        if (mission.getTowingCar() != null) {
            TowingCar car = mission.getTowingCar();
            availableCars = List.of(AvailableCarDto.builder()
                    .carCode(car.getCode())
                    .battery(car.getBattery())
                    .currentLocation(car.getLastPosX() + "," + car.getLastPosY())
                    .build());
        } else {
            availableCars = getAvailableCarsSortedByBattery();
        }
        
        List<PathOptionDto> pathOptions = mockPathPlanning(mission.getDepartNode(), mission.getDestNode());

        // 2. 관제사 알림 전송
        AdminAlertDto alert = AdminAlertDto.builder()
                .missionId(mission.getId())
                .pilotId(mission.getPilotId())
                .departNode(mission.getDepartNode())
                .destNode(mission.getDestNode())
                .availableCars(availableCars)
                .pathOptions(pathOptions)
                .build();

        webSocketService.notifyAdminRequest(alert);
        log.info("🔔 [운반] 관제사 승인 대기: MissionID={}", mission.getId());
    }

    private void handleMissionRejection(Mission mission, String controllerId, String reason) {
        mission.updateStatus(MissionStatus.REJECTED);
        saveLog(mission, LogType.REJECT, "Rejected by " + controllerId + ": " + reason);
        
        if (mission.getPilotId() != null) {
            webSocketService.notifyPilotResult(mission.getPilotId(), 
                MissionResponseDto.builder()
                        .missionId(mission.getId())
                        .status("REJECTED")
                        .message(reason)
                        .build());
        }
    }

    private void handleMissionApproval(Mission mission, String controllerId, ATCDecisionDto decision) {
        // 차량 조회 및 상태 검증 (Locking 권장, 여기선 생략)
        TowingCar car = towingCarRepository.findByCode(decision.getSelectedCarCode())
                .orElseThrow(() -> new IllegalArgumentException("차량 없음: " + decision.getSelectedCarCode()));

        if (car.getCarStatus() != CarStatus.IDLE) {
            webSocketService.sendErrorToUser(controllerId, "차량이 이미 작업 중입니다.");
            throw new IllegalStateException("차량 상태 불가");
        }

        // 상태 업데이트
        assignCarToMission(mission, car, decision.getSelectedEdgeIds());
        saveLog(mission, LogType.APPROVE, "Approved by " + controllerId + ", Car: " + car.getCode());

        // 알림 및 명령
        notifyMissionUpdate(mission);
        
        // "미션 경로를 따라 이동하라" 명령 전송
        sendMqttAfterCommit(car.getCode(), "START_MISSION", Map.of(
            "path", decision.getSelectedEdgeIds(),
            "missionId", mission.getId()
        ));
    }

    // =================================================================================
    // Helper Methods (유틸리티)
    // =================================================================================

    private void assignCarToMission(Mission mission, TowingCar car, List<String> route) {
        mission.assignCar(car, route);
        mission.updateStatus(MissionStatus.RUNNING);
        
        // 차량 상태 동기화 (Service 내에서 Entity 상태 변경)
        car.updateStatus(
                car.getLastPosX(), car.getLastPosY(), car.getLastHeading(), 
                car.getBattery(), CarStatus.MOVING, mission
        );
    }

    private void notifyMissionUpdate(Mission mission) {
        MissionResponseDto response = MissionResponseDto.from(mission);
        
        // 1. 기장에게 알림
        if (mission.getPilotId() != null) {
            webSocketService.notifyPilotResult(mission.getPilotId(), response);
        }
        // 2. 전체 관제사 현황판 업데이트
        webSocketService.broadcastMissionUpdate(response);
    }

    /**
     * DB 트랜잭션이 성공적으로 커밋된 후에만 MQTT 메시지를 발송합니다.
     * (데이터 정합성 보장: DB에는 없는데 차가 움직이는 사고 방지)
     */
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
            if (data != null && !data.isEmpty()) {
                payload.put("data", data);
            }

            String json = objectMapper.writeValueAsString(payload);
            String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
            
            mqttOutboundService.publish(topic, json);
            log.info("📡 MQTT Sent [Topic: {}] Payload: {}", topic, json);
        } catch (JsonProcessingException e) {
            log.error("❌ MQTT Payload JSON 변환 실패", e);
        } catch (Exception e) {
            log.error("❌ MQTT 발송 실패", e);
        }
    }

    private List<AvailableCarDto> getAvailableCarsSortedByBattery() {
        return towingCarRepository.findAllByCarStatus(CarStatus.IDLE).stream()
                .sorted(Comparator.comparing(TowingCar::getBattery).reversed())
                .map(car -> AvailableCarDto.builder()
                        .carCode(car.getCode())
                        .battery(car.getBattery())
                        .currentLocation(car.getLastPosX() + "," + car.getLastPosY())
                        .build())
                .collect(Collectors.toList());
    }

    // 추후 PathService로 대체될 Mock 메서드
    private List<PathOptionDto> mockPathPlanning(String start, String end) {
        return List.of(PathOptionDto.builder()
                .optionId(1L)
                .label("추천: 최단 경로")
                .edgeIds(List.of("E_G101_TW1", "E_TW1_RWY"))
                .nodes(List.of(
                    NodeDto.builder().code(start).x(10.0).y(10.0).build(),
                    NodeDto.builder().code(end).x(50.0).y(50.0).build()
                ))
                .build());
    }

    private void saveLog(Mission mission, LogType type, String content) {
        MissionLog logEntity = MissionLog.builder()
                .mission(mission)
                .type(type)
                .message(content)
                .build();
        missionLogRepository.save(logEntity);
    }

    private Mission getMissionOrThrow(Long id) {
        return missionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 미션입니다. ID: " + id));
    }

    private void validateCarAssigned(Mission mission) {
        if (mission.getTowingCar() == null) {
            throw new IllegalStateException("배차된 차량이 없습니다.");
        }
    }

    private Flight resolveFlight(String flightNumber) {
        if (flightNumber == null) return null;
        return flightRepository.findByFlightNumber(flightNumber)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 항공편 코드: " + flightNumber));
    }

    private MissionType resolveMissionType(MissionType type) {
        return type != null ? type : MissionType.TRANSPORT;
    }
}