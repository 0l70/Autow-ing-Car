package com.project.global.error.exception;

import org.springframework.http.HttpStatus;

/**
 * 잘못된 요청일 때 발생하는 예외 (400)
 * 예: 유효하지 않은 파라미터, 비즈니스 규칙 위반 등
 */
public class InvalidRequestException extends BusinessException {

    public InvalidRequestException(String message) {
        super("INVALID_REQUEST", message, HttpStatus.BAD_REQUEST);
    }

    public InvalidRequestException(String message, Throwable cause) {
        super("INVALID_REQUEST", message, HttpStatus.BAD_REQUEST, cause);
    }
}
