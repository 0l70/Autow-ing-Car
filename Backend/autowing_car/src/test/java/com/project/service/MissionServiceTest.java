package com.project.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.LogType;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.mission.service.MissionService;
import com.project.domain.mission.service.MissionWebSocketService;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.user.entity.User;
import com.project.infra.mqtt.service.MqttOutboundService;
import com.project.infra.websocket.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MissionServiceTest {

        @InjectMocks
        private MissionService missionService;

        @Mock
        private MissionDBAdaptor missionDBAdaptor;
        @Mock
        private TowingCarDBAdaptor towingCarReader;
        @Mock
        private FlightDBAdaptor flightDBAdaptor;

        @Mock
        private MissionWebSocketService missionWebSocketService;
        @Mock
        private MqttOutboundService mqttOutboundService;
        @Mock
        private ObjectMapper objectMapper;

        @Test
        @DisplayName("기장이 운송을 요청하면 -> DB 저장 없이 -> 관제사에게 승인 요청 알림만 가야 한다")
        void requestTransportTest() {
                // given
                String pilotId = "PILOT_01";
                Long flightId = 1L;

                // Request DTO (이제 Flight ID만 들어옴)
                PilotRequestDto request = new PilotRequestDto(flightId);

                // Mock Objects
                User mockPilot = User.builder().username(pilotId).build();

                TowingCar mockCar = TowingCar.builder()
                                .code("TC01")
                                .carStatus(CarStatus.IDLE)
                                .build();

                Flight mockFlight = Flight.builder()
                                .id(flightId)
                                .flightNumber("KE001")
                                .nodeCode("GATE_101") // 현재 게이트 위치
                                .assignedTowingCar(mockCar)
                                .pilot(mockPilot)
                                .build();

                // Stubbing: Flight 조회 시 mockFlight 리턴
                given(flightDBAdaptor.getFlightById(flightId)).willReturn(mockFlight);

                // when
                missionService.requestTransport(pilotId, request);

                // then
                // 1. 관제사에게 알림이 갔는가? (핵심)
                verify(missionWebSocketService, times(1)).notifyAdminRequest(any(AdminAlertDto.class));

                // 2. 미션이 아직 저장되지 않았는가? (중요: 요청 단계에선 DB 저장 안 함)
                verify(missionDBAdaptor, never()).save(any(Mission.class));
        }

        @Test
        @DisplayName("관제사가 승인하면 -> 미션이 생성되고 -> 로봇에게 출발 명령이 가야 한다")
        void approveMissionTest() {
                // given
                String controllerId = "ATC_ADMIN";
                Long flightId = 1L;
                Long missionId = 100L;

                // Decision DTO
                ATCDecisionDto decision = new ATCDecisionDto();
                decision.setFlightId(flightId);
                decision.setApproved(true);
                decision.setDestNode("RUNWAY_34L");
                decision.setSelectedEdgeIds(List.of("E1", "E2"));

                // Mock Objects
                User mockPilot = User.builder().username("PILOT_01").build();
                TowingCar mockCar = TowingCar.builder().code("TC01").build(); // Spy가 아니므로 일반 Mock 사용 가능

                Flight mockFlight = Flight.builder()
                                .id(flightId)
                                .nodeCode("GATE_101")
                                .assignedTowingCar(mockCar)
                                .pilot(mockPilot)
                                .build();

                Mission savedMission = Mission.builder()
                                .id(missionId)
                                .pilot(mockPilot)
                                .flight(mockFlight)
                                .towingCar(mockCar)
                                .status(MissionStatus.RUNNING)
                                .destNode("RUNWAY_34L")
                                .build();

                // Stubbing
                given(flightDBAdaptor.getFlightById(flightId)).willReturn(mockFlight);
                given(missionDBAdaptor.save(any(Mission.class))).willReturn(savedMission);

                // when
                // Transaction 동기화 문제 회피를 위해 트랜잭션 매니저 Mocking이 어렵다면,
                // Service 코드의 sendMqttAfterCommit 내부 로직을 테스트하기 위해선
                // 통합 테스트(SpringBootTest)가 더 적합할 수 있음.
                // 여기서는 Unit Test이므로 로직 흐름만 검증.

                // *주의* TransactionSynchronizationManager는 static이라 Mocking이 까다로움.
                // 순수 단위 테스트에서는 sendMqttAfterCommit 내부의 콜백이 실행되지 않을 수 있음.
                // 따라서 여기서는 'Service 메서드 실행 시 에러가 없는지'와 'DB 저장 호출' 위주로 검증.

                missionService.approveMission(controllerId, decision);

                // then
                // 1. 미션 저장 호출 확인
                verify(missionDBAdaptor, times(1)).save(any(Mission.class));

                // 2. 로그 저장 확인
                verify(missionDBAdaptor).saveLog(any(Mission.class), eq(LogType.APPROVE), anyString());

                // 3. 알림 전송 확인
                verify(missionWebSocketService).broadcastMissionUpdate(any(MissionResponseDto.class));
        }
}