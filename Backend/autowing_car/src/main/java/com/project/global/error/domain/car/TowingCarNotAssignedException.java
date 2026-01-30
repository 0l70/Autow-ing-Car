package com.project.global.error.domain.car;

import com.project.global.error.exception.InvalidRequestException;

/**
 * 항공편에 차량이 배정되지 않았을 때 발생하는 예외
 */
public class TowingCarNotAssignedException extends InvalidRequestException {

    public TowingCarNotAssignedException(String flightNumber) {
        super("항공편에 차량이 배정되지 않았습니다: " + flightNumber);
    }

    public TowingCarNotAssignedException(Long flightId) {
        super("항공편에 차량이 배정되지 않았습니다: ID=" + flightId);
    }
}
