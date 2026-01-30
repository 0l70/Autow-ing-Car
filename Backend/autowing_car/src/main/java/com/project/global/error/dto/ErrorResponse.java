package com.project.global.error.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;

import com.project.global.error.exception.BusinessException;

/**
 * 에러 응답 DTO
 * 클라이언트에게 구조화된 에러 정보를 전달
 */
@Getter
@Builder
public class ErrorResponse {

    /**
     * 에러 코드 (예: "RESOURCE_NOT_FOUND", "CONFLICT")
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
     * 요청 경로
     */
    private String path;

    /**
     * 추가 상세 정보 (선택)
     * 예: Validation 에러 시 필드별 에러 메시지
     */
    private Map<String, String> details;

    /**
     * BusinessException으로부터 ErrorResponse 생성
     */
    public static ErrorResponse of(BusinessException ex, String path) {
        return ErrorResponse.builder()
                .errorCode(ex.getErrorCode())
                .message(ex.getMessage())
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }

    /**
     * Validation 에러를 위한 ErrorResponse 생성
     */
    public static ErrorResponse validationError(Map<String, String> fieldErrors, String path) {
        return ErrorResponse.builder()
                .errorCode("VALIDATION_ERROR")
                .message("입력 값이 올바르지 않습니다.")
                .details(fieldErrors)
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }

    /**
     * 일반 예외를 위한 ErrorResponse 생성
     */
    public static ErrorResponse internalError(String path) {
        return ErrorResponse.builder()
                .errorCode("INTERNAL_ERROR")
                .message("서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.")
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }
}
