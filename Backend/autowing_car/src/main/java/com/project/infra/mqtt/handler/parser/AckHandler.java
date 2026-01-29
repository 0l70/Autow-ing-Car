package com.project.infra.mqtt.handler.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.infra.mqtt.config.MqttIncomingMessage;

import org.springframework.stereotype.Component;

@Component
public class AckHandler implements MqttTopicHandler {

    @Override
    public String getTopicType() {
        return "ack";
    }

    @Override
    public MqttIncomingMessage parse(String topic, JsonNode payload) {
        String carCode;
        if (payload.has("car_code")) {
            carCode = payload.get("car_code").asText();
        } else if (payload.has("carId")) {
            carCode = payload.get("carId").asText();
        } else {
            throw new IllegalArgumentException("ack Payload must contain 'car_code' or 'carId'");
        }
        return MqttIncomingMessage.Ack.builder()
                .carCode(carCode)
                .messageType(getTopicType())
                .payload(payload)
                .build();
    }
}
