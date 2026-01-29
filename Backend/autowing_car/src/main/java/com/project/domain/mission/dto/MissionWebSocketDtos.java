package com.project.domain.mission.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.project.domain.mission.entity.Mission;
import lombok.*;
import java.util.List;

public class MissionWebSocketDtos {

    // [기장 -> 서버] 운송 요청
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PilotRequestDto {
        private Long flightId;
    }

    // [신규 추가] 알림 타입 정의
    public enum NotificationType {
        MISSION_REQUEST, // 승인/반려 필요
        MANUAL_CONTROL, // 긴급 (수동 조작)
        EMERGENCY_STOP // 긴급 (비상 정지)
    }

    // [서버 -> 관제사] 승인 요청 및 알림
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminAlertDto {
        // [신규 필드]
        @Builder.Default
        private NotificationType type = NotificationType.MISSION_REQUEST;
        private String message;
        private String severity; // INFO, WARNING, CRITICAL

        // [기존 필드]
        private Long flightId;
        private String flightNumber;
        private String pilotId;
        private String currentGate;
        private String activeRunway;
        private List<PathOptionDto> pathOptions;
    }

    // [관제사 -> 서버] 승인/반려 결정
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ATCDecisionDto {
        private Long flightId;
        @JsonProperty("approved")
        private boolean approved;
        private String rejectReason;

        // 승인 시 필수 (관제사가 선택한 값)
        private List<String> selectedEdgeIds;
        private String destNode;
    }

    // [서버 -> 클라이언트] 상태 응답
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MissionResponseDto {
        private Long missionId;
        private String status;
        private String message;
        private String correlationId; // 프론트엔드 Request ID와 매핑
        private Object data; // 추가 페이로드 (경로 등)

        public static MissionResponseDto from(Mission mission) {
            return MissionResponseDto.builder()
                    .missionId(mission.getId())
                    .status(mission.getStatus().name())
                    .message("Mission Updated")
                    .build();
        }
    }

    // [보조 DTO]
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PathOptionDto {
        Long optionId;
        String label;
        List<String> edgeIds;
    }
}