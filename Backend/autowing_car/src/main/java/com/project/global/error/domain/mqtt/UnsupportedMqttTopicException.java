package com.project.global.error.domain.mqtt;

import com.project.global.error.exception.InvalidRequestException;

/**
 * 지원하지 않는 MQTT 토픽으로 메시지 수신 시 발생하는 예외
 */
public class UnsupportedMqttTopicException extends InvalidRequestException {

    public UnsupportedMqttTopicException(String topic) {
        super(String.format("지원하지 않는 MQTT 토픽입니다: %s", topic));
    }
}
