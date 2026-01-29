package com.project.domain.towingcar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarMonitorService {

    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final MissionDBAdaptor missionDBAdaptor;
    private final FlightDBAdaptor flightDBAdaptor;
    private final MapDBAdaptor mapDBAdaptor;
    private final TowingCarService towingCarService;

    private boolean isAutoConnectEnabled = true;
    private boolean isAutoDisconnectEnabled = true;
    private static final double ARRIVAL_THRESHOLD = 2.0;

    @Transactional
    public void processCarMonitoring(String carCode, JsonNode payload) {
        TowingCar car = towingCarDBAdaptor.getCarByCode(carCode);

        // Parse Data
        double x = payload.get("x").asDouble();
        double y = payload.get("y").asDouble();
        double heading = payload.get("yaw").asDouble();
        double velocity = payload.get("v").asDouble();
        CarStatus status = parseCarStatus(payload.path("mode").asText());
        int battery = payload.get("battery").asInt();

        // [Auto Trigger] 로봇이 멈췄을 때(IDLE) 자동 연결/해제 체크
        checkAndTriggerAutoActions(car, x, y, status);

        // DB Update & Log
        car.updateStatus(x, y, heading, velocity, battery, status);

        Mission mission = (car.getCurrentMissionId() != null)
                ? missionDBAdaptor.getMissionById(car.getCurrentMissionId())
                : null;
        saveDrivingLog(car, mission);
    }

    private void checkAndTriggerAutoActions(TowingCar car, double x, double y, CarStatus status) {
        if (status != CarStatus.IDLE)
            return;

        // Auto Connect
        if (isAutoConnectEnabled && car.getCarStatus() == CarStatus.MOVING_TO_LOAD) { // DB상 배차이동중
            Flight flight = flightDBAdaptor.getFlightByAssignedCar(car);
            if (flight != null && isArrivedAt(x, y, flight.getNodeCode())) {
                towingCarService.connectCar("SYSTEM", new CarConnectRequestDto(flight.getId(), "AUTO_CONNECT"));
            }
        }

        // Auto Disconnect
        if (isAutoDisconnectEnabled && car.getCurrentMissionId() != null) {
            Mission mission = missionDBAdaptor.getMissionById(car.getCurrentMissionId());
            if (mission.getStatus() == MissionStatus.RUNNING && isArrivedAt(x, y, mission.getDestNode())) {
                towingCarService.disconnectCar("SYSTEM",
                        new CarDisconnectRequestDto(mission.getFlight().getId(), "AUTO_DISCONNECT"));
            }
        }
    }

    private boolean isArrivedAt(double curX, double curY, String nodeCode) {
        Node node = mapDBAdaptor.getNodeByCode(nodeCode);
        if (node == null)
            return false;
        double dx = curX - node.getPosX();
        double dy = curY - node.getPosY();
        return (dx * dx + dy * dy) <= (ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD);
    }

    private void saveDrivingLog(TowingCar car, Mission mission) {
        DrivingLog log = DrivingLog.builder()
                .towingCarId(car.getId())
                .missionId(mission != null ? mission.getId() : null)
                .carStatus(car.getCarStatus())
                .missionStatus(mission != null ? mission.getStatus() : MissionStatus.WAITING)
                .posX(car.getLastPosX()).posY(car.getLastPosY())
                .heading(car.getLastHeading()).velocity(car.getLastVelocity()).battery(car.getBattery())
                .build();
        towingCarDBAdaptor.saveDrivingLog(log);
    }

    private CarStatus parseCarStatus(String s) {
        try {
            return CarStatus.valueOf(s.toUpperCase());
        } catch (Exception e) {
            return CarStatus.IDLE;
        }
    }
}
