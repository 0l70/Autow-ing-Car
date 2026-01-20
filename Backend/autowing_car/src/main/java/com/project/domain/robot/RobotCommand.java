package com.project.domain.robot;

// [수신] 로봇 -> 서버 (위치, 조향, 속도 등)
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

// [송신] 서버 -> 로봇 (명령 및 목표 좌표)
@Getter @Setter @Builder
public class RobotCommand {
    private String command; // START, STOP, EMERGENCY_STOP
    private Double targetLat;
    private Double targetLng;
}