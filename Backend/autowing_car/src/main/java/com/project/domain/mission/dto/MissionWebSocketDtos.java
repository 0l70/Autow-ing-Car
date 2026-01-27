package com.project.domain.mission.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.project.domain.mission.entity.Mission;
import lombok.*;

import java.util.List;

public class MissionWebSocketDtos {

    // 1. [기장 -> 서버]
    @Data
    @NoArgsConstructor // 👈 Jackson 필수
    @AllArgsConstructor // 👈 테스트 코드에서 new PilotRequestDto(...) 쓸 때 필요
    public static class PilotRequestDto {
        private String departNode;
        private String destNode;
        private String flightNumber;
    }

    // 2. [서버 -> 관제사]
    @Data
    @Builder
    @NoArgsConstructor // 👈 Jackson 필수 (이게 없어서 테스트 실패함)
    @AllArgsConstructor
    public static class AdminAlertDto {
        private Long missionId;
        private Long flightId;
        private String pilotId;
        private String departNode;
        private String destNode;

        private List<AvailableCarDto> availableCars;
        private List<PathOptionDto> pathOptions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AvailableCarDto {
        private String carCode;
        private Integer battery;
        private String currentLocation;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PathOptionDto {
        private Long optionId;
        private String label;
        private List<String> edgeIds;
        private List<NodeDto> nodes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NodeDto {
        private String code;
        private Double x;
        private Double y;
    }

    // 3. [관제사 -> 서버]
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ATCDecisionDto {
        private Long missionId;
        private Long flightId;

        @JsonProperty("approved") // JSON 필드명 명시 권장
        private boolean approved;

        private String selectedCarCode;
        private List<String> selectedEdgeIds;
        private String rejectReason;
    }

    // 4. [서버 -> 기장/로봇]
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MissionResponseDto {
        private Long missionId;
        private String status;
        private String message;

        public static MissionResponseDto from(Mission mission) {
            return MissionResponseDto.builder()
                    .missionId(mission.getId())
                    .status(mission.getStatus().name())
                    .message("Mission Updated")
                    .build();
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PilotControlDto {
        private Long missionId;
        private String command; // "PAUSE", "RESUME"
    }

    // 5. [기장 -> 서버] 연결 요청 (Scenario A)
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConnectRequestDto {
        private Long scheduleId; // 항공편 스케줄 ID
        private String type; // "CONNECT"
    }

    // 6. [서버 -> 기장] 연결 응답 (Scenario A)
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConnectResponseDto {
        private Long towingCarId;
        private String towingCarCode;
        private String status; // "CONNECTING", "CONNECTED"
    }

    // 7. [기장 -> 서버] 해제 요청 (Scenario C)
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisconnectRequestDto {
        private Long missionId;
        private String command; // "DISCONNECT_START"
    }

    // 8. [서버 -> 기장] 해제 응답 (Scenario C)
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisconnectResponseDto {
        private Long missionId;
        private String status; // "DISCONNECTING", "DISCONNECTED"
    }
}