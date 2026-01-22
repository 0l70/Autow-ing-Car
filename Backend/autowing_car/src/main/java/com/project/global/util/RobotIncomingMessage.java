package com.project.infra.mqtt.util;

import com.fasterxml.jackson.databind.JsonNode;

import lombok.Builder;
import lombok.Getter;
import lombok.ToString;

@Getter
@Builder
@ToString
public class RobotIncomingMessage {
    private String carId;       // 차량 ID (TC01)
    private String messageType; // 토픽의 마지막 부분 (monitoring, event, ack ...)
    private JsonNode payload;   // 내용은 아직 뭔지 모르니 JsonNode로 유연하게 받음
}