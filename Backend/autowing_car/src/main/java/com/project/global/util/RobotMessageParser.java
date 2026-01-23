package com.project.global.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RobotMessageParser {

    private final ObjectMapper objectMapper;

    // 예: autowing_car/v1/TC01/monitoring -> carId=TC01, type=monitoring
    // 예: autowing_car/v1/TC01/ack       -> carId=TC01, type=event
    public RobotIncomingMessage parse(String topic, String payloadString) {
        try {
            // 1. 토픽 분해
            String[] parts = topic.split("/");
            
            // 유효성 검사 (최소 길이 체크)
            if (parts.length < 4) { 
                throw new IllegalArgumentException("토픽 구조가 너무 짧습니다: " + topic);
            }

            // 2. 동적 추출
            // 구조: [0]autowing_car / [1]v1 / [2]{carId} / [3]{topicName}
            String carId = parts[2];
            String messageType = parts[3]; // 여기가 핵심! (monitoring, event 등등)

            // 3. Payload를 유연한 JSON(JsonNode)으로 변환
            JsonNode payload = objectMapper.readTree(payloadString);

            return RobotIncomingMessage.builder()
                    .carId(carId)
                    .messageType(messageType)
                    .payload(payload)
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("메시지 파싱 실패: " + topic, e);
        }
    }
}

