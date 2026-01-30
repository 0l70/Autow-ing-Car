package com.project.global.error.exception;

import org.springframework.http.HttpStatus;

/**
 * 리소스 충돌이 발생했을 때 예외 (409)
 * 예: 이미 사용 중인 차량, 중복된 데이터 등
 */
public class ConflictException extends BusinessException {

    public ConflictException(String message) {
        super("CONFLICT", message, HttpStatus.CONFLICT);
    }

    public ConflictException(String message, Throwable cause) {
        super("CONFLICT", message, HttpStatus.CONFLICT, cause);
    }
}
