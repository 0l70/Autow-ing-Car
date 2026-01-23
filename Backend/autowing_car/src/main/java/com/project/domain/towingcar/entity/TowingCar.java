package com.project.domain.towingcar.entity;

import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.mission.entity.Mission;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "towing_car")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TowingCar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "towing_car_id")
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code; // 예: "TC01"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CarStatus carStatus; // IDLE, TOWING, MOVING...

    @Enumerated(EnumType.STRING)
    private MissionStatus missionStatus;
    @Column(nullable = false)
    private Integer battery;

    // --- 시스템 복구용 마지막 위치 ---
    @Column(name = "last_pos_x")
    private Double lastPosX;

    @Column(name = "last_pos_y")
    private Double lastPosY;

    @Column(name = "last_heading")
    private Double lastHeading;

    // [비즈니스 로직] 상태 업데이트 메서드
    public void updateStatus(Double x, Double y, Double heading, Integer battery, CarStatus carStatus, MissionStatus missionStatus) {
        this.lastPosX = x;
        this.lastPosY = y;
        this.lastHeading = heading;
        this.battery = battery;
        this.carStatus = carStatus;
        this.missionStatus = missionStatus;
        // JPA Dirty Checking에 의해 트랜잭션 종료 시 자동 Update 쿼리 나감
    }
}