package com.project.domain.robot;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RobotStatusDto {
    private String robotId;   // 로봇 식별자
    private double latitude;  // 위도
    private double longitude; // 경도
    private double speed;     // 속도
    private int battery;      // 배터리 잔량 (%)
    private String status;    // 상태 (RUNNING, STOPPED, ERROR 등)
    private long timestamp;   // 보낸 시간
}