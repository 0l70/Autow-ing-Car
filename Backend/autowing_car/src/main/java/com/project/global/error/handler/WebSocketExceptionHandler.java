package com.project.global.error.handler;

import com.project.global.error.dto.WebSocketErrorDto;
import com.project.global.error.exception.BusinessException;
import com.project.infra.websocket.constant.WebSocketTopics;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.security.Principal;
import java.time.LocalDateTime;

/**
 * WebSocket (@MessageMapping) 예외 처리 핸들러
 * 
 * STOMP 메시지 처리 중 발생한 예외를 처리하고
 * 사용자에게 /queue/errors로 에러 메시지 전송
 */
@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class WebSocketExceptionHandler {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 비즈니스 예외 처리
     * 사용자의 /queue/errors로 에러 메시지 전송
     */
    @MessageExceptionHandler(BusinessException.class)
    @SendToUser(WebSocketTopics.QUEUE_ERRORS)
    public WebSocketErrorDto handleBusinessException(
            BusinessException ex,
            Principal principal) {
        String username = principal != null ? principal.getName() : "anonymous";
        log.warn("⚠️ [WebSocket] Business Exception for user {}: [{}] {}",
                username, ex.getErrorCode(), ex.getMessage());

        return WebSocketErrorDto.of(ex, WebSocketTopics.QUEUE_ERRORS);
    }

    /**
     * 일반 예외 처리
     * 예상치 못한 에러를 사용자에게 전송
     */
    @MessageExceptionHandler(Exception.class)
    @SendToUser(WebSocketTopics.QUEUE_ERRORS)
    public WebSocketErrorDto handleGeneralException(
            Exception ex,
            Principal principal) {
        String username = principal != null ? principal.getName() : "anonymous";
        log.error("❌ [WebSocket] Unexpected exception for user " + username, ex);

        return WebSocketErrorDto.internalError(WebSocketTopics.QUEUE_ERRORS);
    }

    /**
     * 특정 사용자에게 에러 메시지 전송 (유틸리티 메서드)
     */
    public void sendErrorToUser(String username, String errorCode, String message) {
        WebSocketErrorDto error = WebSocketErrorDto.custom(errorCode, message, WebSocketTopics.QUEUE_ERRORS);

        messagingTemplate.convertAndSendToUser(username, WebSocketTopics.QUEUE_ERRORS, error);
        log.warn("⚠️ [WebSocket] Sent error to user {}: [{}] {}", username, errorCode, message);
    }
}
