package com.project.domain.towingcar.dto;

import lombok.Getter;

import lombok.*;

public class TowingCarWebSocketDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarConnectRequestDto {
        private Long flightId; // 기존 scheduleId -> flightId 명칭 통일
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarDisconnectRequestDto {
        private Long flightId; // 해제 시에도 Flight 기준으로 처리
    }

    @Getter
    public class TowingCarDTO {
        private String code;
        private Double posX;
        private Double posY;
        private Double heading;
        private Double velocity;
        private Integer battery;
        private String status; // IDLE, TOWING, MOVING...
    }

}
