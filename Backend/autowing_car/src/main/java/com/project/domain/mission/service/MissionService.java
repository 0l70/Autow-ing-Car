package com.project.domain.mission.service;

import com.project.domain.common.LogType;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.map.service.MapDBAdaptor;
import com.project.domain.map.service.MapService;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarMqttService;
import com.project.global.error.domain.car.TowingCarNotAssignedException;
import com.project.domain.map.entity.Node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionDBAdaptor missionDBAdaptor;
    private final MapDBAdaptor mapDBAdaptor;
    private final FlightDBAdaptor flightDBAdaptor;

    private final MissionWebSocketService missionWebSocketService;
    private final MapService mapService;
    private final TowingCarMqttService towingCarMqttService;

    /**
     * [기장 요청] 경로 계산 후 관제사에게 알림 (DB 저장 X)
     */
    @Transactional(readOnly = true)
    public void requestTransport(String pilotId, PilotRequestDto request) {
        Flight flight = flightDBAdaptor.getFlightById(request.getFlightId());

        TowingCar car = flight.getAssignedTowingCar();
        if (car == null)
            throw new TowingCarNotAssignedException(flight.getFlightNumber());

        String currentGate = flight.getNodeCode();
        String activeRunway = "RUNWAY"; // Mock: 실제 로직은 기상/운영 DB 연동 필요

        Node startNode = mapDBAdaptor.getNodeByCode(currentGate);
        Node endNode = mapDBAdaptor.getNodeByCode(activeRunway);
        // 관제사에게 전송
        missionWebSocketService.notifyAdminRequest(AdminAlertDto.builder()
                .flightId(flight.getId())
                .flightNumber(flight.getFlightNumber())
                .pilotId(pilotId)
                .currentGate(currentGate)
                .activeRunway(activeRunway)
                .pathOptions(calculatePathOptions(startNode, endNode))
                .build());

        log.info("📡 [Request] Pilot={} Flight={} -> ATC", pilotId, flight.getFlightNumber());
    }

    /**
     * [관제사 승인] 미션 생성 -> 로봇 출발 명령
     */
    @Transactional
    public void approveMission(String controllerId, ATCDecisionDto decision) {
        Flight flight = flightDBAdaptor.getFlightById(decision.getFlightId());

        if (!decision.isApproved()) {
            missionWebSocketService.notifyPilotResult(flight.getPilot().getUsername(),
                    MissionResponseDto.builder().status("REJECTED").message(decision.getRejectReason()).build());
            return;
        }

        TowingCar car = flight.getAssignedTowingCar();

        Mission mission = Mission.builder()
                .pilot(flight.getPilot())
                .flight(flight)
                .towingCar(car)
                .status(MissionStatus.RUNNING)
                .departNode(flight.getNodeCode())
                .destNode(decision.getDestNode())
                .routeEdgeIds(decision.getSelectedEdgeIds()) // List -> String 변환
                .build();

        Mission savedMission = missionDBAdaptor.save(mission);
        car.assignMission(savedMission.getId());

        missionDBAdaptor.saveLog(savedMission, LogType.APPROVE, "Approved by " + controllerId);
        notifyMissionUpdate(savedMission);

        // 로봇 출발
        sendMqttAfterCommit(car.getCode(), Map.of(
                "path", decision.getSelectedEdgeIds(),
                "missionId", savedMission.getId(),
                "destNode", savedMission.getDestNode()));
    }

    // --- Helpers ---
    private List<PathOptionDto> calculatePathOptions(Node start, Node end) {
        // 실제 경로 탐색 로직 (Mock)
        return mapService.findShortestPath(start, end);
    }

    private void notifyMissionUpdate(Mission mission) {
        MissionResponseDto response = MissionResponseDto.from(mission);
        missionWebSocketService.notifyPilotResult(mission.getPilot().getUsername(), response);
        missionWebSocketService.broadcastMissionUpdate(response);
    }

    private void sendMqttAfterCommit(String carCode, Map<String, Object> data) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    towingCarMqttService.startTransport(carCode, data);
                }
            });
        } else {
            towingCarMqttService.startTransport(carCode, data);
        }
    }
}