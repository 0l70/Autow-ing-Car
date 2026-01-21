package com.project.domain.robot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Builder;
import lombok.Data;
/*
    {
  "car_id": "TC01",
  "ts": 1705820000123,     // [추가] 타임스탬프 (생성 시간)
  "x": 15.5,
  "y": 30.2,
  "yaw": 180.0,            // 각도 (Heading)
  "v": 1.2,                // [추가] 속도 (m/s) - 멈췄는지 가는지 확인용
  "battery": 85,
  "mode": "MOVING",        // 대분류 상태
  "phase": "PATH_TRACKING" // 상세 동작 단계
}
    로봇 상태 전송 DTO
*/
@Data
@Builder
public class RobotStatusDTO {

    @JsonProperty("car_id") // JSON의 car_id를 carId에 매핑
    private String carId;

    @JsonProperty("ts")
    private long timestamp; // 보낸 시간 (Epoch Millis)

    private double x;
    private double y;
    private double yaw;     // angle 대신 전문용어 yaw 사용
    
    @JsonProperty("v")
    private double velocity; // 속도 (velocity)

    private int battery;

    private String mode;    // IDLE, MOVING, ERROR ...
    private String phase;   // 상세 동작 (옵션)
}