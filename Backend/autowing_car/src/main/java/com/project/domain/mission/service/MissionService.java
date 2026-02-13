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
import com.project.domain.map.entity.NodeType;
import com.project.domain.map.entity.Edge; // [NEW]

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import com.project.domain.user.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.project.global.util.TxUtil; // [NEW]

import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;

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
    private final MissionCacheService missionCacheService; // [NEW]

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
        // [DB 연동] 'R'로 시작하는 노드(활주로)를 동적으로 찾습니다.
        String activeRunway = mapDBAdaptor.findAllNodes().stream()
                .filter(node -> node.getNodeType() == NodeType.RUNWAY)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("사용 가능한 활주로 노드가 없습니다."))
                .getNodeCode();

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
            missionWebSocketService.notifyPilotResult(flight.getPilot().getEmail(),
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

        // [New Logic] Path Generation & MQTT
        // Payload simplification: Start, End, Edges, FinalAction
        Map<String, Object> data = new HashMap<>();
        data.put("carId", car.getCode());
        data.put("startNode", mission.getDepartNode());
        data.put("endNode", mission.getDestNode());
        data.put("edgeIds", decision.getSelectedEdgeIds());
        data.put("finalAction", "UNDOCK"); // Pushback complete -> Undock

        Map<String, Object> payload = new HashMap<>();
        payload.put("msgId", UUID.randomUUID().toString());
        payload.put("timestamp", System.currentTimeMillis());
        payload.put("type", "DRIVE");
        payload.put("taskId", "MISSION_" + savedMission.getId());
        payload.put("data", data);

        TxUtil.executeAfterCommit(() -> towingCarMqttService.sendDriveCommand(car.getCode(), payload));
    }

    // --- Helpers ---
    private List<PathOptionDto> calculatePathOptions(Node start, Node end) {
        // 실제 경로 탐색 로직 (Mock)
        return mapService.findShortestPath(start, end);
    }

    private void notifyMissionUpdate(Mission mission) {
        MissionResponseDto response = MissionResponseDto.from(mission);

        User pilot = mission.getPilot();
        missionWebSocketService.notifyPilotResult(pilot.getEmail(), response);

        // Redis Caching
        missionCacheService.saveMission(response); // [NEW]

        missionWebSocketService.broadcastMissionUpdate(response);
    }

    public List<MissionResponseDto> getAllActiveMissions() {
        return missionDBAdaptor.findActiveMissions().stream()
                .map(MissionResponseDto::from)
                .collect(Collectors.toList());
    }
}