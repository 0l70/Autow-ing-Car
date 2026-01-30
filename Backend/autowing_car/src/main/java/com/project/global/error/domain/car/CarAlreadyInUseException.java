package com.project.global.error.domain.car;

import com.project.global.error.exception.ConflictException;

/**
 * 차량이 이미 사용 중일 때 발생하는 예외
 */
public class CarAlreadyInUseException extends ConflictException {

    public CarAlreadyInUseException(String carCode) {
        super("차량이 이미 사용 중입니다: " + carCode);
    }

    public CarAlreadyInUseException(String carCode, String currentStatus) {
        super(String.format("차량이 이미 사용 중입니다: %s (현재 상태: %s)", carCode, currentStatus));
    }
}
