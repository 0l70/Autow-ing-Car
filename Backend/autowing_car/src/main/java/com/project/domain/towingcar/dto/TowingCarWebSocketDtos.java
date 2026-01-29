package com.project.domain.towingcar.dto;

import lombok.Getter;

import lombok.*;

public class TowingCarWebSocketDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarConnectRequestDto {
        private Long flightId;
        private String reqId; // 프론트엔드 Request ID
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarDisconnectRequestDto {
        private Long flightId;
        private String reqId; // 프론트엔드 Request ID
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarMoveRequestDto {
        private String type; // MOVE, STOP, PUSHBACK
        private Long flightId;
        private String carId;
        private String reqId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarModeRequestDto {
        private String mode; // AUTO, MANUAL
        private String carId;
        private String reqId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarEmergencyRequestDto {
        private String carId;
        private String reqId;
    }

    @Getter
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
