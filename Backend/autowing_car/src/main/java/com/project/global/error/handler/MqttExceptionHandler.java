package com.project.global.error.handler;

import com.project.global.error.exception.BusinessException;
import com.project.infra.mqtt.handler.MqttSignalProcessor;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * MQTT 메시지 처리 중 발생한 예외 핸들러
 * 
 * MQTT는 비동기 메시지이므로 클라이언트에게 직접 응답할 수 없음
 * 대신 로그 기록 및 에러 토픽으로 메시지 발행
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MqttExceptionHandler {

    private final MqttService mqttService;

    private static final String ERROR_TOPIC_PREFIX = "error/";

    /**
     * MQTT 메시지 처리 중 예외 처리
     * 
     * @param topic   원본 토픽
     * @param payload 원본 페이로드
     * @param ex      발생한 예외
     */
    public void handleException(String topic, String payload, Exception ex) {
        if (ex instanceof BusinessException) {
            handleBusinessException(topic, payload, (BusinessException) ex);
        } else {
            handleGeneralException(topic, payload, ex);
        }
    }

    /**
     * 비즈니스 예외 처리
     */
    private void handleBusinessException(String topic, String payload, BusinessException ex) {
        log.warn("⚠️ [MQTT] Business Exception on topic '{}': [{}] {}",
                topic, ex.getErrorCode(), ex.getMessage());

        // 에러 토픽으로 에러 정보 발행 (선택적)
        String errorTopic = ERROR_TOPIC_PREFIX + topic.replace("/", "_");
        String errorMessage = createErrorMessage(ex.getErrorCode(), ex.getMessage());

        try {
            mqttService.publish(errorTopic, errorMessage);
            log.debug("[MQTT] Published error to topic: {}", errorTopic);
        } catch (Exception publishEx) {
            log.error("[MQTT] Failed to publish error message", publishEx);
        }
    }

    /**
     * 일반 예외 처리
     */
    private void handleGeneralException(String topic, String payload, Exception ex) {
        log.error("❌ [MQTT] Unexpected exception on topic '{}', payload: {}",
                topic, payload, ex);

        // 치명적 에러는 에러 토픽으로 발행
        String errorTopic = ERROR_TOPIC_PREFIX + topic.replace("/", "_");
        String errorMessage = createErrorMessage("INTERNAL_ERROR", "MQTT 메시지 처리 중 오류 발생");

        try {
            mqttService.publish(errorTopic, errorMessage);
        } catch (Exception publishEx) {
            log.error("[MQTT] Failed to publish error message", publishEx);
        }
    }

    /**
     * 에러 메시지 생성 (JSON 형식)
     */
    private String createErrorMessage(String errorCode, String message) {
        String timestamp = LocalDateTime.now()
                .format(DateTimeFormatter.ISO_DATE_TIME);

        return String.format(
                "{\"errorCode\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\"}",
                errorCode, message, timestamp);
    }

    /**
     * Try-Catch로 감싼 MQTT 처리 유틸리티
     * 
     * @param topic     MQTT 토픽
     * @param payload   메시지 페이로드
     * @param processor 실제 처리 로직
     */
    public void processWithExceptionHandling(
            String topic,
            String payload,
            MqttSignalProcessor processor) {
        try {
            processor.process(topic, payload);
        } catch (Exception ex) {
            handleException(topic, payload, ex);
        }
    }
}
