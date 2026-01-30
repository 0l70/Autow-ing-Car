package com.project.global.error.domain.mqtt;

import com.project.global.error.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * MQTT 메시지 발행 실패 시 발생하는 예외
 */
public class MqttPublishException extends BusinessException {

    public MqttPublishException(String topic, Throwable cause) {
        super("MQTT_PUBLISH_FAILED",
                String.format("MQTT 메시지 발행 실패: topic=%s", topic),
                HttpStatus.INTERNAL_SERVER_ERROR,
                cause);
    }
}
