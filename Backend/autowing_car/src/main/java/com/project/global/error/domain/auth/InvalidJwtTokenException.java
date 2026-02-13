package com.project.global.error.domain.auth;

import com.project.global.error.exception.InvalidRequestException;

/**
 * JWT 토큰에 필수 권한 정보가 없을 때 발생하는 예외
 */
public class InvalidJwtTokenException extends InvalidRequestException {

    public InvalidJwtTokenException() {
        super("권한 정보가 없는 토큰입니다.");
    }

    public InvalidJwtTokenException(String message) {
        super(message);
    }
}
