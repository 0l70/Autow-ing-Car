package com.project.infra.mqtt.handler.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.infra.mqtt.config.MqttIncomingMessage;

public interface MqttTopicHandler {
    /**
     * 해당 핸들러가 처리할 토픽의 마지막 구분자 (Routing Key)
     * 예: "monitoring", "map", "ack"
     */
    String getTopicType();

    /**
     * 메시지 파싱 로직
     */
    MqttIncomingMessage parse(String topic, JsonNode payload);
}
