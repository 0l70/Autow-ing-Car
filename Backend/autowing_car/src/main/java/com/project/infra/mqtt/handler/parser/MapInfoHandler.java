package com.project.infra.mqtt.handler.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.infra.mqtt.config.MqttIncomingMessage;

import org.springframework.stereotype.Component;

@Component
public class MapInfoHandler implements MqttTopicHandler {

    @Override
    public String getTopicType() {
        return "map";
    }

    @Override
    public MqttIncomingMessage parse(String topic, JsonNode payload) {
        String mapId = payload.has("mapId") ? payload.get("mapId").asText() : "UNKNOWN";
        return MqttIncomingMessage.MapData.builder()
                .mapId(mapId)
                .messageType("map_info")
                .payload(payload)
                .build();
    }
}
