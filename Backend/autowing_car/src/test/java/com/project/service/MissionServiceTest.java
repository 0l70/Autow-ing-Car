package com.project.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.repository.MissionLogRepository;
import com.project.domain.mission.repository.MissionRepository;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.mission.service.MissionService;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.infra.mqtt.service.MqttOutboundService;
import com.project.infra.websocket.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

/**
 * MissionService 단위 테스트 (Unit Test)
 *
 * 목적:
 * 1. 기장의 출발 요청 시, DB에 바로 저장하지 않고 관제사에게 승인 요청이 가는지 확인.
 * 2. 관제사의 승인 시, 실제 Mission 데이터가 생성되고 DB에 저장되는지 확인.
 *
 * 테스트 요구사항:
 * - Mockito를 사용하여 Repository와 외부 서비스(WebSocket, MQTT)를 모킹(Mocking)해야 함.
 * - 실제 DB 연결 없이 로직의 흐름만 검증함.
 */
@ExtendWith(MockitoExtension.class)
class MissionServiceTest {

        @InjectMocks
        private MissionService missionService; // 테스트할 실제 서비스 객체

        // 가짜 객체들 (Mock)
        @Mock
        private MissionRepository missionRepository;
        @Mock
        private TowingCarRepository towingCarRepository;
        @Mock
        private FlightRepository flightRepository;
        @Mock
        private WebSocketService webSocketService;

        @Mock
        private MissionLogRepository missionLogRepository; // 이게 없어서 NPE 발생!
        @Mock
        private MqttOutboundService mqttOutboundService; // 얘도 필요할 겁니다
        @Mock
        private ObjectMapper objectMapper;

        @Mock
        private MissionDBAdaptor missionDBAdaptor;
        @Mock
        private TowingCarDBAdaptor towingCarReader;
        @Mock
        private FlightDBAdaptor flightDBAdaptor;

        @Test
        @DisplayName("시나리오 B-1: 기장 출발 요청 -> 미션 생성 안 함 -> 관제사 알림만 전송")
        void createMissionRequestTest() {
                // [배경 설명]
                // 변경 전: 기장이 요청하면 즉시 WAITING 상태의 Mission을 DB에 저장했음.
                // 변경 후: 관제사의 승인이 있어야 미션이 확정되므로, 이 단계에서는 DB 저장을 하지 않음. FlightId 정보만 관제사에게 넘김.

                // given (테스트 데이터 준비)
                String pilotId = "PILOT_01";
                PilotRequestDto request = new PilotRequestDto();
                request.setDepartNode("GATE_101");
                request.setDestNode("RUNWAY_A");
                request.setFlightNumber("KE001");

                TowingCar idleCar = TowingCar.builder().code("TC01").carStatus(CarStatus.IDLE).battery(90).build();
                Flight mockFlight = Flight.builder()
                                .id(1L)
                                .flightNumber("KE001")
                                .assignedTowingCar(idleCar)
                                .build();

                // ❌ [삭제] Repository Mocking은 이제 의미가 없습니다 (Service가 직접 호출하지 않음)
                // given(flightRepository.findByFlightNumber(request.getFlightNumber())).willReturn(Optional.of(mockFlight));

                // ✅ [수정] Service가 실제로 사용하는 Adaptor를 Mocking 해야 합니다!
                // (Adaptor 메서드명이 getFlightByNumber 라고 가정합니다)
                given(flightDBAdaptor.getFlightByFlightNumber("KE001")).willReturn(mockFlight);

                // Mission 저장 Mocking
                Mission mockMission = Mission.builder().id(100L).status(MissionStatus.WAITING).build();
                given(missionRepository.save(any(Mission.class))).willReturn(mockMission);

                // (옵션) Adaptor 안에서 중복 체크 등을 한다면 그에 대한 Mocking도 필요
                // given(missionDBAdaptor.existsActiveMission(...)).willReturn(false);

                // when (실행)
                missionService.createTransportMission(pilotId, request);

                // then (검증)
                verify(missionRepository, times(1)).save(any(Mission.class));
                verify(webSocketService, times(1)).notifyAdminRequest(any(AdminAlertDto.class));
        }

        @Test
        @DisplayName("시나리오 B-5: 관제사 승인 -> 미션 생성 및 저장 -> 토잉카/기장 알림")
        void approveMissionTest() {
                // [배경 설명]
                // 관제사가 화면에서 경로를 선택하고 "승인"을 누른 시점.
                // 이때 비로소 Mission 객체를 생성하고 DB에 저장(INSERT)해야 함.

                // given (준비)
                // 1. 관제사의 결정 데이터 (승인, Flight ID: 1, 경로: Edge1 -> Edge2)
                ATCDecisionDto decision = new ATCDecisionDto();
                decision.setApproved(true);
                decision.setFlightId(1L); // 중요: createMissionRequest에서 넘어온 FlightId를 사용
                decision.setSelectedEdgeIds(List.of("edge1", "edge2"));

                // 2. 연관된 토잉카 가짜 데이터
                TowingCar mockCar = TowingCar.builder()
                                .id(10L)
                                .code("TC01")
                                .carStatus(CarStatus.IDLE)
                                .build();

                // 3. Flight 가짜 객체 생성 (Mockito mock() 사용)
                // Flight 내부의 flight.getPilot().getUsername() 같은 연쇄 호출을 처리하기 위해 Mock 객체 사용
                Flight mockFlightObj = mock(Flight.class);
                com.project.domain.user.entity.User mockPilot = mock(com.project.domain.user.entity.User.class);

                // 가짜 객체의 동작 정의
                given(flightRepository.findById(1L)).willReturn(Optional.of(mockFlightObj)); // DB 조회 시 가짜 Flight 리턴
                given(mockFlightObj.getPilot()).willReturn(mockPilot); // Flight에서 Pilot 조회 시 가짜 Pilot 리턴
                given(mockPilot.getUsername()).willReturn("test_pilot"); // Pilot 이름 조회 시 "test_pilot" 리턴
                given(mockFlightObj.getTowingCar()).willReturn(mockCar); // Flight에 연결된 토잉카 리턴
                given(mockFlightObj.getNodeCode()).willReturn("GATE_101"); // 출발지 정보 리턴

                // 4. 저장될 미션 객체 정의 (missionRepository.save가 호출되면 리턴할 값)
                Mission savedMission = Mission.builder()
                                .id(100L) // 저장이 완료되면 ID 100을 가짐
                                .flight(mockFlightObj)
                                .towingCar(mockCar)
                                .status(MissionStatus.RUNNING)
                                .build();
                given(missionRepository.save(any(Mission.class))).willReturn(savedMission);

                // when (실행)
                // 관제사 ID "ADMIN"이 승인 요청을 보냄
                missionService.approveMission("ADMIN", decision);

                // then (검증)
                // 1. MissionRepository.save()가 정확히 1번 호출되었는지 확인 (DB 저장 확인)
                verify(missionRepository, times(1)).save(any(Mission.class));

                // 2. 토잉카에게 "출발해라(START_MISSION)" 명령이 MQTT로 1번 전송되었는지 확인
                verify(mqttOutboundService, times(1)).publish(anyString(), anyString());

                // 3. 기장 및 관제사 화면 갱신을 위해 WebSocket 메시지가 전송되었는지 확인
                verify(webSocketService, times(1)).broadcastMissionUpdate(any(MissionResponseDto.class));
        }
}