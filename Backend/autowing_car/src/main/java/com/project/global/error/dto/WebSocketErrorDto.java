package com.project.global.error.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

import com.project.global.error.exception.BusinessException;

/**
 * WebSocket 에러 응답 DTO
 * STOMP 메시지로 클라이언트에게 에러 정보 전달
 */
@Getter
@Builder
public class WebSocketErrorDto {

    /**
     * 에러 코드 (예: "RESOURCE_NOT_FOUND", "INVALID_REQUEST")
     */
    private String errorCode;

    /**
     * 사용자에게 표시할 에러 메시지
     */
    private String message;

    /**
     * 에러 발생 시각
     */
    private LocalDateTime timestamp;

    /**
     * 요청 경로 (WebSocket endpoint)
     */
    private String destination;

    /**
     * 심각도 (ERROR, WARNING, INFO)
     */
    private String severity;

    /**
     * BusinessException으로부터 WebSocketErrorDto 생성
     */
    public static WebSocketErrorDto of(BusinessException ex, String destination) {
        return WebSocketErrorDto.builder()
                .errorCode(ex.getErrorCode())
                .message(ex.getMessage())
                .timestamp(LocalDateTime.now())
                .destination(destination)
                .severity("ERROR")
                .build();
    }

    /**
     * 일반 예외를 위한 WebSocketErrorDto 생성
     */
    public static WebSocketErrorDto internalError(String destination) {
        return WebSocketErrorDto.builder()
                .errorCode("INTERNAL_ERROR")
                .message("서버 내부 오류가 발생했습니다.")
                .timestamp(LocalDateTime.now())
                .destination(destination)
                .severity("ERROR")
                .build();
    }

    /**
     * 커스텀 에러 메시지를 위한 WebSocketErrorDto 생성
     */
    public static WebSocketErrorDto custom(String errorCode, String message, String destination) {
        return WebSocketErrorDto.builder()
                .errorCode(errorCode)
                .message(message)
                .timestamp(LocalDateTime.now())
                .destination(destination)
                .severity("ERROR")
                .build();
    }
}
