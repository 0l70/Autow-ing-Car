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
    public void sendCommand(String carId, String jsonPayload) {
        // autowing_car/v1/robot/{carId}/cmd 로 변환
        String topic = String.format(MqttTopics.CMD_FORMAT, carId);
        
        mqttGateway.sendToMqtt(jsonPayload, topic);
        log.info("CMD 발송 [Target: {}]: {}", carId, topic);
    }
}