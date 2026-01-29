package com.project.global.error.domain.mqtt;

import com.project.global.error.exception.InvalidRequestException;

/**
 * MQTT 메시지 파싱 실패 시 발생하는 예외
 */
public class MqttMessageParseException extends InvalidRequestException {

    public MqttMessageParseException(String topic, String reason) {
        super(String.format("MQTT 메시지 파싱 실패: topic=%s, reason=%s", topic, reason));
    }

    public MqttMessageParseException(String topic, Throwable cause) {
        super(String.format("MQTT 메시지 파싱 실패: topic=%s", topic), cause);
    }
}
