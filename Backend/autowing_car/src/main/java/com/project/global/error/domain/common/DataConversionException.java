package com.project.global.error.domain.common;

import com.project.global.error.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * 데이터 변환(Serialization/Deserialization) 실패 시 발생하는 예외
 */
public class DataConversionException extends BusinessException {

    public DataConversionException(String operation, Throwable cause) {
        super("DATA_CONVERSION_FAILED",
                String.format("데이터 변환 실패: %s", operation),
                HttpStatus.INTERNAL_SERVER_ERROR,
                cause);
    }
}
