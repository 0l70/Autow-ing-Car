package com.project.global.error.domain.car;

import com.project.global.error.exception.ResourceNotFoundException;

/**
 * 견인차를 찾을 수 없을 때 발생하는 예외
 */
public class TowingCarNotFoundException extends ResourceNotFoundException {

    public TowingCarNotFoundException(String carCode) {
        super("견인차를 찾을 수 없습니다: " + carCode);
    }

    public TowingCarNotFoundException(Long carId) {
        super("견인차를 찾을 수 없습니다: ID=" + carId);
    }
}
