package com.project.domain.towingcar.entity;

import com.project.domain.common.CarStatus;
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

    // 성능 최적화용 역정규화 컬럼 (현재 수행중인 미션 ID)
    // FK를 걸지 않거나, 걸더라도 nullable로 설정
    @Column(name = "CURRENT_MISSION_ID")
    private Long currentMissionId;

    @Column(nullable = false)
    private Integer battery;

    // --- 시스템 복구용 마지막 위치 ---
    @Column(name = "last_pos_x")
    private Double lastPosX;

    @Column(name = "last_pos_y")
    private Double lastPosY;

    @Column(name = "last_heading")
    private Double lastHeading;

    @Column(name = "last_velocity")
    private Double lastVelocity;

    // [비즈니스 로직] 상태 업데이트 메서드
    @Builder
    public TowingCar(String code, Integer battery, CarStatus carStatus) {
        this.code = code;
        this.battery = battery;
        this.carStatus = carStatus;
    }

    // 상태 업데이트 메서드
    public void updateStatus(Double x, Double y, Double heading, Double velocity, Integer battery, CarStatus status) {
        this.lastPosX = x;
        this.lastPosY = y;
        this.lastHeading = heading;
        this.lastVelocity = velocity;
        this.battery = battery;
        this.carStatus = status;
    }

    // 미션 시작 시 호출
    public void assignMission(Long missionId) {
        this.currentMissionId = missionId;
        this.carStatus = CarStatus.MOVING_TO_LOAD;
    }

    // 미션 종료 시 호출
    public void clearMission() {
        this.currentMissionId = null;
        this.carStatus = CarStatus.IDLE;
    }
}