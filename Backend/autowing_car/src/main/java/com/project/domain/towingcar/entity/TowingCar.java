package com.project.domain.towingcar.entity;

import java.time.LocalDateTime;

import com.project.domain.towingcar.dto.TowingCarStatusDTO;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


/*
    * 로봇 엔티티
    * 로봇의 현재 상태 및 정보 관리
    * 작성자: cgantro
    * 작성일: 2026-01-21
    * 수정일: 2026-01-21
*/
@Entity
@Table(name = "robot_history")
@Getter
@Setter
@NoArgsConstructor
public class TowingCar {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String carId;
    private double x;
    private double y;
    private double yaw;
    private double velocity;
    
    private int battery;
    
    // 추후 Enum으로 변경 고려
    private String mode;
    private String phase; // 상세 상태도 저장

    private LocalDateTime recordedAt; // DB 저장 시간

    public TowingCar(TowingCarStatusDTO dto) {
        this.carId = dto.getCarId();
        this.x = dto.getX();
        this.y = dto.getY();
        this.yaw = dto.getYaw();
        this.velocity = dto.getVelocity();
        this.battery = dto.getBattery();
        this.mode = dto.getMode();
        this.phase = dto.getPhase();
        this.recordedAt = LocalDateTime.now();
    }
}