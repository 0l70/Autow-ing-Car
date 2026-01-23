package com.project.infra.mqtt.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.mqtt.support.MqttHeaders; // 헤더 상수 사용 권장
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.MessagingException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttInboundHandler implements MessageHandler {

    private final TowingCarSignalProcessor towinCarSignalProcessor;

    @Override
    public void handleMessage(Message<?> message) throws MessagingException {
        try {
            // 1. 토픽 추출 (헤더 상수 사용 또는 문자열 직접 사용)
            String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);
            if (topic == null) {
                topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            }

            // 2. Payload 안전 변환 (String 캐스팅 오류 방지)
            Object payloadObj = message.getPayload();
            String payload;

            if (payloadObj instanceof byte[]) {
                payload = new String((byte[]) payloadObj, StandardCharsets.UTF_8);
            } else if (payloadObj instanceof String) {
                payload = (String) payloadObj;
            } else {
                payload = payloadObj.toString();
            }

            // 로그는 디버그 레벨로 남겨서 운영 시 노이즈를 줄임
            log.debug("[MQTT Recv] T={}, P={}", topic, payload);

            // 3. 비즈니스 로직으로 위임
            towinCarSignalProcessor.processAndBroadcast(topic, payload);

        } catch (Exception e) {
            log.error("MQTT 핸들링 실패: {}", e.getMessage());
            // 필요 시 예외를 다시 던지거나 DLQ(Dead Letter Queue) 처리
        }
    }
}