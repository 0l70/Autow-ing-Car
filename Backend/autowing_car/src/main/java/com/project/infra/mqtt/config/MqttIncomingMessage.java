package com.project.infra.mqtt.config;

import com.fasterxml.jackson.databind.JsonNode;

import lombok.Builder;
import lombok.Getter;
import lombok.ToString;

public class MqttIncomingMessage {
    @Getter
    @Builder
    @ToString
    public static class CarData extends MqttIncomingMessage {
        private String carCode; // 차량 ID (TC01)
        private String messageType; // 토픽의 마지막 부분 (monitoring, event, ack ...)
        private JsonNode payload; // 내용은 아직 모르니 JsonNode로 유연하게 받음
    }

    /**
     * 맵 전체에 대한 정보
     */
    @Getter
    @Builder
    @ToString
    public static class MapData extends MqttIncomingMessage {
        private String mapId; // 맵 ID (MAP01)
        private String messageType; // 토픽의 마지막 부분 (monitoring, event, ack ...)
        private JsonNode payload; // 내용은 아직 모르니 JsonNode로 유연하게 받음
    }

    @Getter
    @Builder
    @ToString
    public static class Ack extends MqttIncomingMessage {
        private String carCode; // 차량 ID (TC01)
        private String messageType; // 토픽의 마지막 부분 (monitoring, event, ack ...)
        private JsonNode payload; // 내용은 아직 모르니 JsonNode로 유연하게 받음
    }
}