package com.project.global.error.handler;

import com.project.global.error.dto.ErrorResponse;
import com.project.global.error.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 전역 예외 처리 핸들러
 * 모든 Controller에서 발생한 예외를 여기서 처리
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 비즈니스 예외 처리
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(
            BusinessException ex,
            HttpServletRequest request) {
        log.warn("⚠️ Business Exception [{}]: {}", ex.getErrorCode(), ex.getMessage());

        ErrorResponse response = ErrorResponse.builder()
                .errorCode(ex.getErrorCode())
                .message(ex.getMessage())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity
                .status(ex.getHttpStatus())
                .body(response);
    }

    /**
     * Validation 예외 처리 (Bean Validation)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        log.warn("⚠️ Validation Exception: {}", ex.getMessage());

        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));

        ErrorResponse response = ErrorResponse.builder()
                .errorCode("VALIDATION_ERROR")
                .message("입력 값이 올바르지 않습니다.")
                .details(errors)
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(response);
    }

    /**
     * 예상치 못한 예외 처리
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(
            Exception ex,
            HttpServletRequest request) {
        log.error("❌ Unexpected Exception", ex);

        ErrorResponse response = ErrorResponse.builder()
                .errorCode("INTERNAL_ERROR")
                .message("서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.")
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(response);
    }
}
