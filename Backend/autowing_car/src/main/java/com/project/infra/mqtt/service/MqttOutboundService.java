package com.project.infra.mqtt.service;

import com.project.infra.mqtt.MqttTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttOutboundService {

    // Spring Integration Gateway
    @MessagingGateway(defaultRequestChannel = "mqttOutboundChannel")
    public interface MqttGateway {
        void sendToMqtt(@Payload String data, @Header(MqttHeaders.TOPIC) String topic);
    }

    private final MqttGateway mqttGateway;

    /**
     * 특정 로봇에게 명령 전송
     */
    public void publish(String topic, String payload) {
        mqttGateway.sendToMqtt(payload, topic);
        log.info("📤 MQTT 발송 [Topic: {}]", topic);
    }
}