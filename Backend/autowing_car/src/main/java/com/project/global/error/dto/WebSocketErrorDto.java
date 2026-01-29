package com.project.global.error.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

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

    public static WebSocketErrorDto from(Exception ex, String destination) {
        return WebSocketErrorDto.builder()
                .errorCode("INTERNAL_ERROR")
                .message(ex.getMessage())
                .timestamp(LocalDateTime.now())
                .destination(destination)
                .severity("ERROR")
                .build();
    }
}
