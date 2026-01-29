package com.project.global.error.exception;

import org.springframework.http.HttpStatus;

/**
 * 비즈니스 예외의 최상위 클래스
 * 모든 커스텀 예외는 이 클래스를 상속받아야 함
 */
public abstract class BusinessException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus httpStatus;

    protected BusinessException(String errorCode, String message, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    protected BusinessException(String errorCode, String message, HttpStatus httpStatus, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
