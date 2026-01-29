package com.project.domain.flight.service;

import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.flight.entity.Flight;
import com.project.domain.user.entity.User;
import com.project.domain.user.service.UserDBAdaptor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;

/**
 * 스케줄러 등록해서 알아서 항공편에 토잉카 추가 시키는 로직 추가해야함(일단 MVP 테스트 끝나고 ㄱㄱ)
 * 
 */
@Service
@RequiredArgsConstructor
public class FlightService {

        private final FlightDBAdaptor flightDBAdaptor;
        private final UserDBAdaptor userDBAdaptor;

        /**
         * 기장 ID로 오늘 출발 예정 Flight 정보 조회 및 DTO 변환
         * 
         * @param pilotId 기장 username
         * @return FlightInfoDto
         */
        @Transactional(readOnly = true)
        public FlightInfoDto getFlightInfoByPilot(String pilotId) {
                // 1. pilotId(email)로 User 조회
                User pilot = userDBAdaptor.findByEmail(pilotId)
                                .orElseThrow(() -> new IllegalArgumentException("Pilot not found: " + pilotId));

                // 2. 해당 기장의 Flight 조회 (오늘 출발 예정)
                Flight flight = flightDBAdaptor.findByPilotAndDepartureDate(pilot, LocalDate.now())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "No flight scheduled for pilot: " + pilotId));

                // 3. DTO 변환
                return FlightInfoDto.builder()
                                .flightId(flight.getId())
                                .flightNumber(flight.getFlightNumber())
                                .pilotName(flight.getPilot().getUsername())
                                .aircraftRegistrationNum(
                                                flight.getAircraft() != null ? flight.getAircraft().getRegistrationNum()
                                                                : "N/A")
                                .aircraftTypeCode(flight.getAircraft() != null ? flight.getAircraft().getTypeCode()
                                                : "N/A")
                                .destination(flight.getNodeCode()) // 목적지 게이트
                                .departureTime(flight.getScheduledTime() != null ? flight.getScheduledTime().toString()
                                                : null)
                                .gateNode(flight.getNodeCode())
                                .assignedCarId(flight.getAssignedTowingCar() != null
                                                ? flight.getAssignedTowingCar().getCode()
                                                : null)
                                .build();
        }
}
