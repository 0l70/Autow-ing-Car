package com.project.infra.mqtt.handler.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.infra.mqtt.config.MqttIncomingMessage;

import org.springframework.stereotype.Component;

@Component
public class MonitoringHandler implements MqttTopicHandler {

    @Override
    public String getTopicType() {
        return "monitoring";
    }

    @Override
    public MqttIncomingMessage parse(String topic, JsonNode payload) {
        String carCode;
        if (payload.has("car_code")) {
            carCode = payload.get("car_code").asText();
        } else if (payload.has("carId")) {
            carCode = payload.get("carId").asText();
        } else {
            throw new IllegalArgumentException("Monitoring Payload must contain 'car_code' or 'carId'");
        }

        return MqttIncomingMessage.CarData.builder()
                .carCode(carCode)
                .messageType("monitoring")
                .payload(payload)
                .build();
    }
}
