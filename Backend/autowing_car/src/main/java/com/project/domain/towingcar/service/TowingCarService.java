package com.project.domain.towingcar.service;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.towingcar.dto.TowingCarCommandDTO;
import com.project.domain.towingcar.dto.TowingCarStatusDTO;
import com.project.domain.towingcar.entity.TowingCarCommandHistory;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarCommandHistoryRepository;
import com.project.domain.towingcar.repository.TowingCarHistoryRepository;
import com.project.global.util.RobotIncomingMessage;
import com.project.global.util.RobotMessageParser;
import com.project.infra.mqtt.MqttTopics; // 토픽 상수 관리 클래스
import com.project.infra.mqtt.handler.RobotSignalProcessor; // 인터페이스 위치 확인 필요
import com.project.infra.mqtt.service.MqttOutboundService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarService implements RobotSignalProcessor {

    private final TowingCarCommandHistoryRepository commandRepository;
    private final TowingCarHistoryRepository historyRepository;
    
    private final RobotMessageParser parser;
    private final TowingCarNotificationService notificationService;


    private final MqttOutboundService mqttOutboundService; // 우리가 만든 Outbound 서비스
    private final SimpMessagingTemplate wsTemplate;
    private final ObjectMapper objectMapper;

    // =================================================================
    // 1. 기장(Pilot) 영역: "가도 되나요?" (요청)
    // =================================================================
    @Transactional
    public String requestCommand(String carId, TowingCarCommandDTO.CommandType type) {
        
        // 1. DTO 생성
        TowingCarCommandDTO dto = TowingCarCommandDTO.builder()
                .carId(carId)
                .type(type)
                .build();

        // 2. DB 저장 (상태: REQUESTED)
        TowingCarCommandHistory history = new TowingCarCommandHistory(dto);
        commandRepository.save(history);

        // 3. 관제사(Admin)에게 알림 전송 (WebSocket)
        // 관제사 UI 화면에 "띵동! 승인 요청이 왔습니다" 띄우기 위함
        String alertMessage = String.format("차량 [%s]의 [%s] 명령 승인 요청 (ID: %s)", 
                                            carId, type, dto.getCmdId());
        wsTemplate.convertAndSend("/topic/admin/alerts", alertMessage);

        log.info("📢 [요청] {} -> {}, ID: {}", carId, type, dto.getCmdId());
        return dto.getCmdId();
    }

    // =================================================================
    // 2. 관제사(Controller) 영역: "승인합니다." (MQTT 발송)
    // =================================================================
    @Transactional
    public void approveCommand(String cmdId) {
        
        // 1. 요청 내역 조회
        TowingCarCommandHistory history = commandRepository.findById(cmdId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 명령 ID입니다."));

        // 2. 상태 검증 (중복 승인 방지)
        if (history.getStatus() != TowingCarCommandHistory.CommandStatus.REQUESTED) {
            throw new IllegalStateException("승인 대기 상태가 아닙니다.");
        }

        try {
            // 3. Entity -> DTO 변환 (전송용)
            TowingCarCommandDTO cmdDto = TowingCarCommandDTO.builder()
                    .cmdId(history.getCmdId())
                    .carId(history.getCarId())
                    .type(TowingCarCommandDTO.CommandType.valueOf(history.getType().name()))
                    .targetNode(history.getTargetNode())
                    .params(objectMapper.readValue(history.getParameters(), Map.class)) // JSON String -> Map
                    .build();

            // 4. MQTT Payload 생성 (JSON String)
            String jsonPayload = objectMapper.writeValueAsString(cmdDto);
            
            // 5. MQTT 발송 (OutboundService 사용)
            // 토픽 예: autowing/car/TC01/cmd
            String topic = String.format(MqttTopics.CMD_FORMAT, history.getCarId());
            mqttOutboundService.publish(topic, jsonPayload);

            // 6. DB 상태 업데이트 (APPROVED -> SENT)
            history.setStatus(TowingCarCommandHistory.CommandStatus.APPROVED); // or SENT
            history.setApprovedAt(LocalDateTime.now());
            
            log.info("🚀 [승인/전송] Topic: {}, Cmd: {}", topic, history.getType());

        } catch (Exception e) {
            log.error("❌ 승인 처리 중 오류 발생: {}", e.getMessage());
            throw new RuntimeException("명령 승인 실패", e);
        }
    }

    @Transactional
    public void rejectCommand(String cmdId) {
        TowingCarCommandHistory history = commandRepository.findById(cmdId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 명령 ID입니다."));
        
        history.setStatus(TowingCarCommandHistory.CommandStatus.REJECTED);
        log.info("🛑 [반려] ID: {}", cmdId);
    }
    
    // =================================================================
    // 3. 로봇 영역: 모니터링 데이터 수신 (Inbound Interface 구현)
    // =================================================================
    /**
     * MqttInboundHandler에서 호출하는 메서드
     * topic: autowing/car/TC01/monitoring
     * payload: { "car_id": "TC01", "x": 10... }
     */
    @Override
    @Transactional
    public void processAndBroadcast(String topic, String payload) {
        try {
            // 1. 해석해 (Parse)
            RobotIncomingMessage message = parser.parse(topic, payload);
            // DTO 변환 로직 추가 해야함 -> 무결성 보장 되야됨 (필수 필드 체크 등)
            // RobotStatusDTO dto = RobotStatusDTO.builder()
            //         .carId(message.getCarId())
            //         .build();

            // 2. 저장해 (Persist)
            // historyRepository.save(new RobotHistory(dto));
            saveToDatabaseIfNecessary(message);
            // 3. 알려줘 (Broadcast)
            notificationService.broadcast(message);

            // log.info("로봇({}) 데이터 처리 완료", dto.getCarId());


        } catch (Exception e) {
            // 여기서 에러가 나면 '어떤 로봇'인지 알기 어려우므로 로그만 찍고 넘어감
            log.error("로봇 데이터 처리 중 스킵: {}", e.getMessage());
        }
    }

    // DB 저장은 스키마가 엄격하므로 타입별 처리가 필요함
    private void saveToDatabaseIfNecessary(RobotIncomingMessage msg) {
        try {
            switch (msg.getMessageType()) {
                case "monitoring":
                    // JsonNode -> DTO 변환 후 저장
                    TowingCarStatusDTO statusDto = objectMapper.treeToValue(msg.getPayload(), TowingCarStatusDTO.class);
                    statusDto.setCarId(msg.getCarId());
                    historyRepository.save(new TowingCar(statusDto));
                    break;
                // ack나 heartbeat 등 저장이 필요 없는 건 그냥 pass
                default:
                    break;
            }
        } catch (Exception e) {
            log.error("DB 저장 실패: {}", e.getMessage());
        }
    }
}