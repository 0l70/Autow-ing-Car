package com.project.domain.robot.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
    * 로봇 텔레메트리 로그 엔티티
    * 로봇의 위치, 속도, 배터리 상태 등의 정보를 기록
    * 인덱스: car_id + ts (특정 로봇의 시간대별 조회 최적화)
    * 작성자: cgantro
    * 작성일: 2026-01-21
    * 수정일: 2026-01-21
*/
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(indexes = @Index(name = "idx_telemetry_robot_ts", columnList = "car_id, ts"))
public class RobotTelemetryLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, name = "car_id")
    private String carId;

    private Double x;        // 로봇의 X 좌표
    private Double y;        // 로봇의 Y 좌표
    private Double yaw;      // 로봇의 방향 (yaw)
    private Double speed;    // 속도

    // private Integer rssi; // 신호 세기 (네트워크 상태 분석용)
    private Integer batteryPct;
    private LocalDateTime ts;         // 타임스탬프

}
