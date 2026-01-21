package com.project.domain.robot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RobotSignalService implements RobotSignalProcessor {

    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate; // WebSocket 전송기
    // private final RobotRepository robotRepository; // DB 저장용

    @Override
    public void processAndBroadcast(String topic, String payload) {
        try {
            // 1. 토픽에서 carId 추출 (autowing_car/v1/robot/{carId}/telemetry)
            String[] parts = topic.split("/");
            String carId = parts[3]; // 인덱스는 실제 토픽 구조에 따라 조정 필요
            String msgType = parts[4]; // telemetry, state 등

            // 2. JSON 파싱 및 데이터 검증
            JsonNode root = objectMapper.readTree(payload);

            // 3. (옵션) DB 저장 로직
            // saveToDatabase(carId, msgType, root);

            // 4. WebSocket 브로드캐스트
            // 클라이언트는 "/topic/robot/{carId}/{msgType}"을 구독함
            String destination = String.format("/topic/robot/%s/%s", carId, msgType);
            messagingTemplate.convertAndSend(destination, payload);
            
            // log.debug("WS 전송 완료: {} -> {}", topic, destination);

        } catch (Exception e) {
            log.error("데이터 처리 실패: topic={}, err={}", topic, e.getMessage());
        }
    }
}