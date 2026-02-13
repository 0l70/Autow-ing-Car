package com.project.infra.mqtt.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.infra.mqtt.gateway.MqttGateway;
import com.project.global.error.domain.mqtt.MqttPublishException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttServiceImpl implements MqttService {

    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    @Override
    public void publish(String topic, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            mqttGateway.sendToMqtt(json, topic);
            log.info("📤 MQTT 발송 [Topic: {}] Data: {}", topic, json);
        } catch (JsonProcessingException e) {
            log.error("MQTT Serialization Error: {}", e.getMessage());
            throw new MqttPublishException(topic, e);
        }
    }
}
