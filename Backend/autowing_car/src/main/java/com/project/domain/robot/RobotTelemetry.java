package com.project.domain.robot;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

// [수신] 로봇 -> 서버 (위치, 조향, 속도 등)
@Getter @Setter @ToString
public class RobotTelemetry {
    private Long robotId;
    private Double lat;
    private Double lng;
    private Double speed;
    private Double steering;
    private String status; // MOVING, STOP, EMERGENCY
}

// [송신] 서버 -> 로봇 (명령 및 목표 좌표)