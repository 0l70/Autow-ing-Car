package com.project.infra.mqtt.handler.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.infra.mqtt.config.MqttIncomingMessage;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttIncomingMessageParser {

    private final ObjectMapper objectMapper;
    private final List<MqttTopicHandler> handlerList;
    private final Map<String, MqttTopicHandler> handlerMap = new HashMap<>();

    @PostConstruct
    public void init() {
        for (MqttTopicHandler handler : handlerList) {
            handlerMap.put(handler.getTopicType(), handler);
            log.info("Registered MQTT Handler: {}", handler.getTopicType());
        }
    }

    public MqttIncomingMessage parse(String topic, String payloadString) {
        try {
            JsonNode payload = objectMapper.readTree(payloadString);

            // 1. Extract Routing Key (Last part of topic)
            // e.g., "autowing_car/v1/monitoring" -> "monitoring"
            // e.g., "autowing_car/v1/map" -> "map"
            // e.g., "autowing_car/v1/ack" -> "ack"
            String routingKey = topic.substring(topic.lastIndexOf('/') + 1);

            // 2. Lookup Handler
            MqttTopicHandler handler = handlerMap.get(routingKey);
            if (handler != null) {
                return handler.parse(topic, payload);
            }

            throw new IllegalArgumentException("지원하지 않는 토픽입니다: " + topic);

        } catch (Exception e) {
            throw new RuntimeException("메시지 파싱 실패: " + topic, e);
        }
    }
}
