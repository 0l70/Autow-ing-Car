package com.project.domain.mission.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.LogType;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.flight.service.FlightService;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.infra.mqtt.MqttTopics;
import com.project.infra.mqtt.service.MqttOutboundService;
import com.project.infra.websocket.service.WebSocketService;
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
        private final TowingCarDBAdaptor towingCarReader;
        private final FlightDBAdaptor flightDBAdaptor;

        private final WebSocketService webSocketService;
        private final MqttOutboundService mqttOutboundService;
        private final ObjectMapper objectMapper;

        // =========================================================================
        // Phase 1. 차량 호출 및 연결 (Dispatch & Connection) - 미션 생성 X
        // =========================================================================

        /**
         * 기장이 "차량 호출" 버튼을 눌렀을 때 실행.
         * 미션을 만들지 않고, Flight에 차량을 배정(Assign)하고 로봇을 부른다.
         */
        @Transactional
        public void dispatchCarToFlight(String flightNumber) {
                Flight flight = flightDBAdaptor.findFlightByFlightNumber(flightNumber);

                // 1. 이미 배정된 차가 있는지 확인
                if (flight.getAssignedTowingCar() != null) {
                        throw new IllegalStateException("이미 배정된 차량이 있습니다: " + flight.getAssignedTowingCar().getCode());
                }

                // 2. 가용 차량(IDLE) 찾기 (배터리 많은 순)
                TowingCar car = towingCarReader.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE);

                // 3. 항공편에 차량 예약 (DB 업데이트)
                flight.setAssignedTowingCar(car); // Flight 엔티티에 setAssignedTowingCar(car)

                // 4. 차량 상태 변경 (이동 중)
                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(),
                                car.getLastVelocity(), car.getBattery(), CarStatus.MOVING); // 아직 Mission ID는 없음
                log.info("🚗 [배차 완료] Flight={} <-> Car={}", flightNumber, car.getCode());

                // 5. 로봇에게 "게이트로 이동하라" 명령 전송
                sendMqttAfterCommit(car.getCode(), "MOVE_TO_GATE", Map.of(
                                "targetNode", flight.getGateNumber(),
                                "flightNumber", flightNumber));
        }

        // =========================================================================
        // Phase 2. 운송 미션 생성 및 시작 (Mission Creation & Transport) - 미션 생성 O
        // =========================================================================

        /**
         * 차량이 도착하고 물리적 연결(Connect)이 완료된 후,
         * 기장이 "운송 시작(Go to Runway)"을 요청했을 때 실행.
         */
        @Transactional
        public void createTransportMission(String pilotId, PilotRequestDto request) {
                Flight flight = flightDBAdaptor.findFlightByFlightNumber(request.getFlightNumber());

                // 1. 사전 조건 검사: 차량이 배정되어 있어야 함
                TowingCar car = flight.getAssignedTowingCar(); // Flight 엔티티에 추가했던 getter
                if (car == null) {
                        throw new IllegalStateException("배정된 차량이 없습니다. 먼저 차량을 호출하세요.");
                }

                // 2. 중복 미션 검사 (이미 실행 중인 미션이 있으면 안됨)
                // (필요 시 missionRepository.exists... 로직 추가)

                // 3. ★ 미션 엔티티 생성 (비로소 DB에 Mission 기록)
                Mission mission = Mission.builder()
                                .pilot(flight.getPilot())
                                .flight(flight)
                                .towingCar(car)
                                .status(MissionStatus.WAITING) // 관제 승인 대기 상태로 시작
                                .departNode(request.getDepartNode()) // 현재 게이트
                                .destNode(request.getDestNode()) // 목적지 (활주로)
                                .build();

                Mission savedMission = missionDBAdaptor.save(mission);

                // 4. 로그 기록
                missionDBAdaptor.saveLog(savedMission, LogType.REQUEST,
                                "Transport Request: " + request.getDepartNode() + " -> " + request.getDestNode());

                // 5. 관제사에게 승인 요청 (알림 전송)
                notifyAdminForApproval(savedMission);

                log.info("📄 [미션 생성] Transport Mission Created: ID={}", savedMission.getId());
        }

        /**
         * 관제사가 "승인(Approve)"을 눌렀을 때 실행.
         * 실제 로봇이 항공기를 끌고 움직이기 시작함.
         */
        @Transactional
        public void approveMission(String controllerId, ATCDecisionDto decision) {
                Mission mission = missionDBAdaptor.getMissionById(decision.getMissionId());

                if (!decision.isApproved()) {
                        handleMissionRejection(mission, controllerId, decision.getRejectReason());
                        return;
                }

                // 1. 미션 상태 변경 (RUNNING)
                mission.updateStatus(MissionStatus.RUNNING);

                // 2. 경로 설정 (관제사가 승인한 경로)
                mission.setRouteEdgeIds(decision.getSelectedEdgeIds()); // 엔티티에 setter 필요

                // 3. 차량 정보 업데이트 (현재 수행중인 미션 ID 매핑)
                TowingCar car = mission.getTowingCar();
                car.assignMission(mission.getId()); // TowingCar.currentMissionId = missionId

                missionDBAdaptor.saveLog(mission, LogType.APPROVE, "Approved by " + controllerId);

                // 4. 알림 전송
                notifyMissionUpdate(mission);

                // 5. 로봇에게 "운송 시작" 명령 전송
                sendMqttAfterCommit(car.getCode(), "START_TRANSPORT", Map.of(
                                "path", decision.getSelectedEdgeIds(),
                                "missionId", mission.getId(),
                                "destNode", mission.getDestNode()));
        }

        // =========================================================================
        // Phase 3. 제어 (Control)
        // =========================================================================

        /**
         * 기장/관제사가 비상 정지(STOP) 등을 눌렀을 때
         */
        public void controlMission(String userId, PilotControlDto controlDto) {
                Mission mission = missionDBAdaptor.getMissionById(controlDto.getMissionId());

                String cmd = controlDto.getCommand(); // "STOP", "RESUME"
                missionDBAdaptor.saveLog(mission, LogType.CONTROL, userId + ": " + cmd);

                // 즉시 전송
                sendMqttImmediate(mission.getTowingCar().getCode(), cmd, Map.of());

                // DB 상태 업데이트 (옵션)
                if ("STOP".equals(cmd))
                        mission.updateStatus(MissionStatus.PAUSED);
                if ("RESUME".equals(cmd))
                        mission.updateStatus(MissionStatus.RUNNING);
        }

        // =========================================================================
        // Private Helpers
        // =========================================================================
        private void notifyAdminForApproval(Mission mission) {
                // 관제사에게 보낼 데이터 구성 (이전 코드 활용)
                // ... (availableCars, pathOptions 등 로직)
                AdminAlertDto alert = AdminAlertDto.builder()
                                .missionId(mission.getId())
                                .pilotId(mission.getPilot().getUsername())
                                .departNode(mission.getDepartNode())
                                .destNode(mission.getDestNode())
                                .build();
                webSocketService.notifyAdminRequest(alert);
        }

        private void handleMissionRejection(Mission mission, String controllerId, String reason) {
                mission.updateStatus(MissionStatus.REJECTED);
                missionDBAdaptor.saveLog(mission, LogType.REJECT, reason);
                webSocketService.notifyPilotResult(mission.getPilot().getUsername(), MissionResponseDto.from(mission));
        }

        private void notifyMissionUpdate(Mission mission) {
                MissionResponseDto response = MissionResponseDto.from(mission);
                if (mission.getPilot() != null)
                        webSocketService.notifyPilotResult(mission.getPilot().getUsername(), response);
                webSocketService.broadcastMissionUpdate(response);
        }

        private void sendMqttAfterCommit(String carCode, String cmd, Map<String, Object> data) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                                sendMqttImmediate(carCode, cmd, data);
                        }
                });
        }

        private void sendMqttImmediate(String carCode, String cmd, Map<String, Object> data) {
                try {
                        Map<String, Object> payload = new HashMap<>();
                        payload.put("cmd", cmd);
                        payload.put("timestamp", System.currentTimeMillis());
                        if (data != null)
                                payload.put("data", data);

                        String json = objectMapper.writeValueAsString(payload);
                        String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
                        mqttOutboundService.publish(topic, json);
                        log.info("📡 MQTT Sent: {}", json);
                } catch (Exception e) {
                        log.error("MQTT Error", e);
                }
        }

}