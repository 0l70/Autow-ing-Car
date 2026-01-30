package com.project.domain.flight.dto;

import lombok.*;

public class FlightWebSocketDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlightInfoDto {
        private Long flightId;
        private String flightNumber;
        private String pilotName;
        private String aircraftRegistrationNum; // 항공기 등록 번호 (예: HL7755)
        private String aircraftTypeCode; // 항공기 기종 (예: B777)
        private String destination;
        private String departureTime; // ISO 8601 format
        private String gateNode;
        private String assignedCarId;
    }
}
