package com.project.domain.towingcar.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;

import jakarta.transaction.Transactional;

import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.repository.MissionRepository;
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
            
    double x = payload.get("x").asDouble();
    double y = payload.get("y").asDouble();
    double heading = payload.get("yaw").asDouble();
    Integer battery = payload.get("battery").asInt();
    double velocity = payload.get("v").asDouble();
    // 로봇이 보내주는 status 문자열 (MOVING, IDLE 등)
    String carStatus = payload.has("mode") ? payload.get("mode").asText() : "IDLE";
    String missionStatus = payload.has("phase") ? payload.get("mission_status").asText() : "WAITING"; 
    CarStatus carStatusEnum = CarStatus.valueOf(carStatus); // 예외처리 필요
    MissionStatus missionStatusEnum = MissionStatus.valueOf(missionStatus);
    
    car.updateStatus(x, y, heading, (int) battery, carStatusEnum); // Heading 등은 payload에 있다면 추가
    // 2. 로그 저장 (Insert)
    DrivingLog log = DrivingLog.builder()
            .towingCar(car)
            .posX(x)
            .posY(y)
            .velocity(velocity)
            .heading(heading)
            .battery(battery)
            .carStatus(carStatusEnum)
            .missionStatus(missionStatusEnum)
            .createdAt(LocalDateTime.now())
            .build();
    
    drivingLogRepository.save(log);
}
}
