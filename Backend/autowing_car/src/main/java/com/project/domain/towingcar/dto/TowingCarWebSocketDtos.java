package com.project.domain.towingcar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.*;

public class TowingCarWebSocketDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarConnectRequestDto {
        private Long flightId;
        // private String reqId; // 프론트엔드 Request ID
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarDisconnectRequestDto {
        private Long flightId;
        // private String reqId; // 프론트엔드 Request ID
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarDispatchRequestDto {
        @JsonProperty("flightNumber")
        private String flightNumber;
        // private String reqId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarModeRequestDto {
        private String mode; // AUTO, MANUAL
        private String car_code;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarEmergencyRequestDto {
        private String carId;
        // private String reqId;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TowingCarDTO {
        private String code;
        private Double posX;
        private Double posY;
        private Double heading;
        private Double velocity;
        private Integer battery;
        private String status; // IDLE, TOWING, MOVING...
    }

}
