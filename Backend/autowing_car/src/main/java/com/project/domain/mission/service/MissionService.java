package com.project.domain.mission.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.repository.MissionRepository;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository;
import com.project.infra.mqtt.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;
import com.project.infra.websocket.service.WebSocketService; // ★ 필수: 웹소켓 서비스 주입
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionRepository missionRepository;
    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    private final WebSocketService webSocketService; // 관제사에게 알림 보내는 배달부
    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;

    /**
     * 1. [기장 요청] 출발 요청 -> 분석 -> 관제사에게 결재 올림
     */
    @Transactional
    public void createMissionRequest(String pilotId, PilotRequestDto request) {
        log.info("기장 요청 수신: {} ({} -> {})", pilotId, request.getDepartNode(), request.getDestNode());

        // Flight 정보 조회 (필수)
        Flight flight = null;
        if (request.getFlightId() != null) {
            flight = flightRepository.findById(request.getFlightId())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 항공편 ID: " + request.getFlightId()));
        }

        // 1. 미션 저장 (WAITING)
        Mission mission = Mission.builder()
                .pilotId(pilotId)
                .flight(flight) // Flight 연결
                .departNode(request.getDepartNode())
                .destNode(request.getDestNode())
                .status(MissionStatus.WAITING)
                .build();
        
        Mission savedMission = missionRepository.save(mission);

        // 2. 가용 차량 조회 (배터리순 정렬)
        List<AvailableCarDto> carOptions = towingCarRepository.findAllByStatus(CarStatus.IDLE).stream()
                .sorted(Comparator.comparing(TowingCar::getBattery).reversed())
                .map(car -> AvailableCarDto.builder()
                        .carCode(car.getCode())
                        .battery(car.getBattery())
                        .currentLocation(car.getLastPosX() + "," + car.getLastPosY())
                        .build())
                .collect(Collectors.toList());

        // 3. 추천 경로 생성 (Mockup: 실제로는 PathFindingService 호출)
        List<PathOptionDto> pathOptions = new ArrayList<>();
        pathOptions.add(PathOptionDto.builder()
                .optionId(1L)
                .label("추천: 최단 경로")
                // 예시 간선 ID들 (DB의 Edge테이블에 있는 edge_code여야 함)
                .edgeIds(List.of("E_G101_TW1", "E_TW1_RWY")) 
                .nodes(List.of(
                    NodeDto.builder().code(request.getDepartNode()).x(10.0).y(10.0).build(),
                    NodeDto.builder().code(request.getDestNode()).x(50.0).y(50.0).build()
                ))
                .build());

        // 4. 관제사에게 알림 전송 (Topic: /topic/admin/requests)
        AdminAlertDto alertData = AdminAlertDto.builder()
                .missionId(savedMission.getId())
                .pilotId(pilotId)
                .departNode(request.getDepartNode())
                .destNode(request.getDestNode())
                .availableCars(carOptions)
                .pathOptions(pathOptions)
                .build();

        // JSON 변환 및 전송
        try {
            String json = objectMapper.writeValueAsString(alertData);
            webSocketService.notifyAdminRequest(alertData);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("JSON 변환 실패", e);
        }
        log.info("→ 관제사에게 승인 요청 전송 완료 (MissionID: {})", savedMission.getId());
    }

    /**
     * 2. [관제사 승인] 결정 -> 차량 배차 -> 로봇 명령 -> 알림
     */
    @Transactional
    public void approveMission(String controllerId, ATCDecisionDto decision) {
        Mission mission = missionRepository.findById(decision.getMissionId())
                .orElseThrow(() -> new IllegalArgumentException("미션 없음"));

        // 반려 처리
        if (!decision.isApproved()) {
            mission.updateStatus(MissionStatus.REJECTED); // Status Enum에 REJECTED 추가 필요 (없으면 CANCELLED 등)
            // 기장에게 알림
            if (mission.getPilotId() != null) {
                webSocketService.notifyPilotResult(mission.getPilotId(), 
                    MissionResponseDto.builder().status("REJECTED").message(decision.getRejectReason()).build());
            }
            return;
        }

        // 승인 처리
        TowingCar car = towingCarRepository.findByCodeForUpdate(decision.getSelectedCarCode())
                .orElseThrow(() -> new IllegalArgumentException("차량 없음"));

        if (car.getStatus() != CarStatus.IDLE) {
            webSocketService.sendErrorToUser(controllerId, "차량이 이미 작업 중입니다.");
            return;
        }

        // 1. 상태 업데이트
        mission.assignCar(car, decision.getSelectedEdgeIds());
        mission.updateStatus(MissionStatus.RUNNING);
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(), car.getBattery(), CarStatus.MOVING);

        // 2. 알림 전송
        MissionResponseDto response = MissionResponseDto.from(mission);
        
        // 기장에게
        if (mission.getPilotId() != null) {
            webSocketService.notifyPilotResult(mission.getPilotId(), response);
        }
        // 관제사 전체에게 (현황판 갱신)
        webSocketService.broadcastMissionUpdate(response);


        // ★ 수정: 트랜잭션 커밋 성공 후에만 실행되도록 예약
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
            sendMissionToRobot(car.getCode(), decision.getSelectedEdgeIds());
            log.info("Transaction Committed. MQTT Command Sent to {}", car.getCode());
            }
        }); 
        log.info("미션 승인 완료: By {}, Car {}", controllerId, car.getCode());
    }

    /**
     * 3. [기장 제어] 비상 정지/재개
     */
    public void controlMission(String pilotId, PilotControlDto controlDto) {
        Mission mission = missionRepository.findById(controlDto.getMissionId())
                .orElseThrow(() -> new IllegalArgumentException("미션 없음"));

        // 권한 체크
        if (!mission.getPilotId().equals(pilotId)) {
            throw new SecurityException("본인의 미션만 제어 가능합니다.");
        }
        
        if (mission.getTowingCar() == null) {
             throw new IllegalStateException("배차된 차량이 없습니다.");
        }

        // MQTT 전송
        try {
            Map<String, Object> payload = Map.of(
                "cmd", controlDto.getCommand(), // "PAUSE" or "RESUME"
                "timestamp", System.currentTimeMillis()
            );
            String json = objectMapper.writeValueAsString(payload);

            String topic = String.format(MqttTopics.CMD_FORMAT, mission.getTowingCar().getCode());
            
            mqttOutboundService.publish(topic, json);
            log.info("기장 제어 명령: {} -> {}", pilotId, controlDto.getCommand());
            
        } catch (Exception e) {
            log.error("제어 명령 전송 실패", e);
            throw new RuntimeException("명령 전송 실패");
        }
    }

    // 내부 메서드: 로봇에게 주행 시작 명령
    private void sendMissionToRobot(String carCode, List<String> pathEdges) {
        try {
            Map<String, Object> payload = Map.of(
                "cmd", "START_MISSION",
                "path", pathEdges
            );
            String json = objectMapper.writeValueAsString(payload);
            String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
            
            mqttOutboundService.publish(topic, json);
            log.info("MQTT 발송 [Topic: {}] Payload: {}", topic, json);
        } catch (Exception e) {
            log.error("MQTT 발송 실패", e);
        }
    }
}