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

    // 예: autowing_car/v1/monitoring -> carCode=TC01, type=monitoring
    // 예: autowing_car/v1/ack -> carCode=TC01, type=ack
    public MqttIncomingMessage parse(String topic, String payloadString) {
        try {
            JsonNode payload = objectMapper.readTree(payloadString);

            String carCode;
            String messageType;

            // Case 1: Single Topic (autowing_car/v1/monitoring)
            if (topic.endsWith("/monitoring")) {
                messageType = "monitoring";
                // Expect "car_code" in payload
                if (payload.has("car_code")) {
                    carCode = payload.get("car_code").asText();
                } else if (payload.has("carId")) {
                    carCode = payload.get("carId").asText();
                } else {
                    throw new IllegalArgumentException("Payload must contain 'car_code'");
                }
            }
            // Case 2: Legacy/Other Topics (autowing_car/v1/{car_code}/ack)
            else {
                String[] parts = topic.split("/");
                if (parts.length < 3) {
                    throw new IllegalArgumentException("토픽 구조가 너무 짧습니다: " + topic);
                }
                carCode = parts[2];
                messageType = parts[3];
            }

            return MqttIncomingMessage.builder()
                    .carCode(carCode)
                    .messageType(messageType)
                    .payload(payload)
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("메시지 파싱 실패: " + topic, e);
        }
    }
}
