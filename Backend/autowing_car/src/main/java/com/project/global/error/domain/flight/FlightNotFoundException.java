package com.project.global.error.domain.flight;

import com.project.global.error.exception.ResourceNotFoundException;

/**
 * 항공편을 찾을 수 없을 때 발생하는 예외
 */
public class FlightNotFoundException extends ResourceNotFoundException {

    public FlightNotFoundException(String flightNumber) {
        super("항공편을 찾을 수 없습니다: " + flightNumber);
    }

    public FlightNotFoundException(Long flightId) {
        super("항공편을 찾을 수 없습니다: ID=" + flightId);
    }
}
