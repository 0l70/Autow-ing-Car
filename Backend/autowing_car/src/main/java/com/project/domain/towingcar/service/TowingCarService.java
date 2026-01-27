package com.project.domain.towingcar.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;

import jakarta.transaction.Transactional;

import com.project.infra.mqtt.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarService {

    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final MissionDBAdaptor missionDBAdaptor;
    private final FlightDBAdaptor flightDBAdaptor;
    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;

    // DB 업데이트 최소 간격(초)
    private static final double DISTANCE_THRESHOLD_METERS = 0.1; // 예: 0.1 미터
    private static final int BATTERY_THRESHOLD_PERCENT = 2;

    /**
     * [배차 로직] 항공편에 차량 배정 및 이동 명령 (Mission 생성 X)
     */
    @Transactional
    public void dispatchCarToFlight(String flightNumber) {
        Flight flight = flightDBAdaptor.findFlightByFlightNumber(flightNumber);

        if (flight.getAssignedTowingCar() != null) {
            throw new IllegalStateException("이미 배정된 차량이 있습니다.");
        }

        // 1. 가용 차량 찾기 (배터리순)
        TowingCar car = towingCarDBAdaptor.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE);

        // 2. Flight에 차량 예약
        flight.assignCar(car);

        // 3. 차량 상태 변경 (이동 중)
        car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                car.getLastVelocity(), car.getBattery(), CarStatus.MOVING);

        // 4. MQTT 명령: "게이트로 이동하라"
        sendMqttDispatchCommand(car.getCode(), flight.getGateNumber(), flightNumber);

        log.info("🚗 Dispatch Success: {} -> {}", car.getCode(), flightNumber);
    }

    private void sendMqttDispatchCommand(String carCode, String targetNode, String flightNum) {
        try {
            Map<String, Object> payload = Map.of(
                    "cmd", "MOVE_TO_GATE",
                    "targetNode", targetNode,
                    "flightNumber", flightNum,
                    "timestamp", System.currentTimeMillis());
            String json = objectMapper.writeValueAsString(payload);
            mqttOutboundService.publish(String.format(MqttTopics.CMD_FORMAT, carCode), json);
        } catch (Exception e) {
            log.error("MQTT Send Error", e);
        }
    }

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
        TowingCar car = towingCarDBAdaptor.getCarByCode(carCode);

        double newX = payload.get("x").asDouble();
        double newY = payload.get("y").asDouble();
        double newHeading = payload.get("yaw").asDouble();
        int newBattery = payload.get("battery").asInt();
        double newVelocity = payload.get("v").asDouble();

        // 로봇이 보내주는 status 문자열 (MOVING, IDLE 등)

        String newCarStatus = payload.has("mode") ? payload.get("mode").asText() : "IDLE";
        CarStatus newCarStatusEnum = CarStatus.valueOf(newCarStatus); // 예외처리 필요

        Mission newMission = null;
        MissionStatus newMissionStatus = MissionStatus.WAITING;
        if (payload.has("missionStatus")) {
            String missionStatusStr = payload.get("missionStatus").asText();
            newMissionStatus = MissionStatus.valueOf(missionStatusStr);
        }

        newMission = missionDBAdaptor.getMissionById(car.getCurrentMissionId());
        // 3. [핵심] DB 업데이트 여부 판단 로직
        boolean isStatusChanged = car.getCarStatus() != newCarStatusEnum;
        boolean isBatteryChanged = Math.abs(car.getBattery() - newBattery) >= BATTERY_THRESHOLD_PERCENT;
        boolean isMissionStatusChanged = newMission.getStatus() != newMissionStatus;

        // C. 이동 거리 체크 (유클리드 거리 계산)
        double dx = newX - (car.getLastPosX() != null ? car.getLastPosX() : 0.0);
        double dy = newY - (car.getLastPosY() != null ? car.getLastPosY() : 0.0);
        double distanceMoved = Math.sqrt(dx * dx + dy * dy);

        boolean isMovedEnough = distanceMoved >= DISTANCE_THRESHOLD_METERS;

        if (isStatusChanged || isBatteryChanged || isMovedEnough || isMissionStatusChanged) {

            if (isMissionStatusChanged) {
                newMission.updateStatus(newMissionStatus);
            }
            // Snapshot 업데이트
            car.updateStatus(newX, newY, newHeading, newVelocity, newBattery, newCarStatusEnum); // Heading 등은 payload에
                                                                                                 // 있다면 추가

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
                .towingCarId(car.getId())
                .missionId(car.getCurrentMissionId())
                .carStatus(car.getCarStatus())
                .missionStatus(car.getCurrentMissionId() == null ? MissionStatus.WAITING : MissionStatus.RUNNING)
                .posX(car.getLastPosX())
                .posY(car.getLastPosY())
                .heading(car.getLastHeading())
                .battery(car.getBattery())
                .velocity(car.getLastVelocity())
                .build();

        towingCarDBAdaptor.saveDrivingLog(logEntity);
    }

}
