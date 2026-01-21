package com.project.infra.mqtt.handler;

import com.project.domain.robot.service.RobotSignalProcessor;
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

    private final RobotSignalProcessor robotSignalProcessor;

    @Override
    public void handleMessage(Message<?> message) throws MessagingException {
        try {
            String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            String payload = (String) message.getPayload();

            // 추상화된 서비스로 위임 (WebSocket 전송은 저 안에서 수행)
            robotSignalProcessor.processAndBroadcast(topic, payload);

        } catch (Exception e) {
            log.error("MQTT 수신 에러: {}", e.getMessage());
        }
    }
}