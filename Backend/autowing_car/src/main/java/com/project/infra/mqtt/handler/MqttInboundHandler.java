package com.project.infra.mqtt.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.MessagingException;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttInboundHandler implements MessageHandler {

    // WebSocket 의존성 제거! -> 대신 인터페이스 주입
    private final RobotSignalProcessor robotSignalProcessor;

    @Override
    public void handleMessage(Message<?> message) throws MessagingException {
        try {
            String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            String payload = (String) message.getPayload();

            // 핸들러는 오직 '수신'과 '전달'에만 집중
            robotSignalProcessor.processAndBroadcast(topic, payload);

        } catch (Exception e) {
            log.error("MQTT 수신 오류: {}", e.getMessage(), e);
        }
    }
}