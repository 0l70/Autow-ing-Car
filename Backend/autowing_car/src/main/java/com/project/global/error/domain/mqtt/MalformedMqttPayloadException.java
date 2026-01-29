package com.project.global.error.domain.mqtt;

import com.project.global.error.exception.InvalidRequestException;

/**
 * MQTT 메시지 페이로드가 필수 필드를 포함하지 않을 때 발생하는 예외
 */
public class MalformedMqttPayloadException extends InvalidRequestException {

    public MalformedMqttPayloadException(String messageType, String missingField) {
        super(String.format("%s 페이로드에 필수 필드가 없습니다: %s", messageType, missingField));
    }

    public MalformedMqttPayloadException(String messageType, String[] requiredFields) {
        super(String.format("%s 페이로드에 필수 필드(%s) 중 하나가 없습니다",
                messageType, String.join(" or ", requiredFields)));
    }
}
