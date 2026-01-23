package com.project.domain.towingcar.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;

import jakarta.transaction.Transactional;

import com.project.domain.towingcar.repository.DrivingLogRepository;
import com.project.domain.towingcar.repository.TowingCarRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarService {
    private final TowingCarRepository towingCarRepository;
    private final DrivingLogRepository drivingLogRepository;

    // DB 업데이트 최소 간격(초)
    private static final double DISTANCE_THRESHOLD_METERS = 0.1; // 예: 0.1 미터
    private static final int BATTERY_THRESHOLD_PERCENT = 2; // 2%
    // private final MissionRepository missionRepository;


    /**
     * [MQTT 수신] 차량 주행 로그 저장
     * 1. TowingCar Table 업데이트(Snapshot)
     * 2. DrivingLog 저장
     * 3. 미션 상태 업데이트
     */

    // TowingCarService.java (구현체)
@Transactional
public void processCarMonitoring(String carCode, JsonNode payload) {
    // 1. 현재 상태 업데이트 (Dirty Checking)
    TowingCar car = towingCarRepository.findByCode(carCode)
            .orElseThrow(() -> new IllegalArgumentException("Unknown Car: " + carCode));
            
    double newX = payload.get("x").asDouble();
    double newY = payload.get("y").asDouble();
    double newHeading = payload.get("yaw").asDouble();
    int newBattery = payload.get("battery").asInt();
    double newVelocity = payload.get("v").asDouble();

    // 로봇이 보내주는 status 문자열 (MOVING, IDLE 등)
    
    String newCarStatus = payload.has("mode") ? payload.get("mode").asText() : "IDLE";
    String newMissionStatus = payload.has("phase") ? payload.get("mission_status").asText() : "WAITING"; 
    CarStatus newCarStatusEnum = CarStatus.valueOf(newCarStatus); // 예외처리 필요
    MissionStatus newMissionStatusEnum = MissionStatus.valueOf(newMissionStatus);

    // 3. [핵심] DB 업데이트 여부 판단 로직
    boolean isStatusChanged = car.getCarStatus() != newCarStatusEnum;
    boolean isBatteryChanged = Math.abs(car.getBattery() - newBattery) >= BATTERY_THRESHOLD_PERCENT;
    // C. 이동 거리 체크 (유클리드 거리 계산)
    double dx = newX - (car.getLastPosX() != null ? car.getLastPosX() : 0.0);
    double dy = newY - (car.getLastPosY() != null ? car.getLastPosY() : 0.0);
    double distanceMoved = Math.sqrt(dx * dx + dy * dy);

    boolean isMovedEnough = distanceMoved >= DISTANCE_THRESHOLD_METERS;

    if (isStatusChanged || isBatteryChanged || isMovedEnough) {
            
            // Snapshot 업데이트
            car.updateStatus(newX, newY, newHeading, newBattery, newCarStatusEnum, newMissionStatusEnum); // Heading 등은 payload에 있다면 추가

            
            // 이력(Log) 저장
            saveDrivingLog(car, newX, newY, newHeading, newBattery, newVelocity);
            
            log.debug("DB Committed [{}]: StatusChange={}, BattChange={}, Moved={}", 
                    carCode, isStatusChanged, isBatteryChanged, String.format("%.2fm", distanceMoved));
    } else {
            // 변화가 미미하면 DB 건너뜀 (Skip)
            log.trace("DB Skipped [{}]: Moved only {:.2f}m", carCode, distanceMoved);
    }

    // 2. 로그 저장 (Insert)
    }

    private void saveDrivingLog(TowingCar car, double x, double y, double heading, int battery, double velocity) {
        DrivingLog logEntity = DrivingLog.builder()
                .towingCar(car)
                .posX(x)
                .posY(y)
                .heading(null)
                .battery(battery)
                .velocity(velocity)
                .createdAt(LocalDateTime.now())
                .build();
        drivingLogRepository.save(logEntity);
    }
}
