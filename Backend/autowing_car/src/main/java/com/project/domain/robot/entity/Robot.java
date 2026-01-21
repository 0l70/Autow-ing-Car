package com.project.domain.robot.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;


/*
    * 로봇 엔티티
    * 로봇의 현재 상태 및 정보 관리
    * 작성자: cgantro
    * 작성일: 2026-01-21
    * 수정일: 2026-01-21
*/
@Entity
@Getter @Setter
public class Robot {
    @Id
    @Column(name = "car_id")
    private String carId; // 예: towcar.TC01

    @Enumerated(EnumType.STRING)
    private RobotMode mode; // 현재 모드 (IDLE, MOVING 등)

    @Enumerated(EnumType.STRING)
    private MissionPhase phase; // 현재 미션 단계

    private boolean online; // v1/status (LWT) 기반 온/오프라인 여부

    // 최신 위치 정보 (Telemetry에서 수신 시 계속 업데이트)
    private Double lastX;
    private Double lastY;
    private Double lastYaw;
    
    private Integer batteryPct;
    private LocalDateTime lastSeenAt; // 마지막 메시지 수신 시각 (Watchdog용)
}

// 로봇의 현재 모드 (v1/state)
enum RobotMode {
    IDLE, MOVING, DOCKING, HOLD, ERROR
}

// 미션 진행 단계 (v1/state - phase)
enum MissionPhase {
    WAIT, DOCKING, READY, TAXI_OUT, DONE, ABORT
}

// 이벤트 중요도 (v1/event)
