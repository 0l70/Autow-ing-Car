package com.project.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.repository.MissionLogRepository;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.mission.service.MissionService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class MissionServiceTest {

    @InjectMocks
    private MissionService missionService;

    // Service가 직접 호출하지 않는 Repository Mock은 제거해도 됩니다.
    // (Service는 이제 Adaptor만 바라봅니다)
    // @Mock private MissionRepository missionRepository;
    // @Mock private TowingCarRepository towingCarRepository;
    // @Mock private FlightRepository flightRepository;

    @Mock
    private WebSocketService webSocketService;
    @Mock
    private MissionLogRepository missionLogRepository;
    @Mock
    private MqttOutboundService mqttOutboundService;
    @Mock
    private ObjectMapper objectMapper;

    // ★ Service가 실제로 주입받아 사용하는 Adaptor들을 Mocking 합니다.
    @Mock
    private MissionDBAdaptor missionDBAdaptor;
    @Mock
    private TowingCarDBAdaptor towingCarReader;
    @Mock
    private FlightDBAdaptor flightDBAdaptor;

    @Test
    @DisplayName("기장이 미션을 요청하면 -> 저장되고 -> 관제사에게 알림이 가야 한다")
    void createMissionRequestTest() {
        // given (준비)
        String pilotId = "PILOT_01";
        PilotRequestDto request = new PilotRequestDto();
        request.setDepartNode("GATE_101");
        request.setDestNode("RUNWAY_A");
        request.setFlightNumber("KE001");

        // 1. TowingCar 준비
        TowingCar idleCar = TowingCar.builder()
                .code("TC01")
                .carStatus(CarStatus.IDLE)
                .battery(90)
                .build();

        // 2. Pilot 준비 (알림 전송 시 pilot.getUsername()을 호출하므로 필요)
        User mockPilot = User.builder()
                .username(pilotId)
                .build();

        // 3. Flight 준비 (Car와 Pilot 포함)
        Flight mockFlight = Flight.builder()
                .id(1L)
                .flightNumber("KE001")
                .assignedTowingCar(idleCar) // ★ 배정된 차량 필수
                .pilot(mockPilot) // ★ 기장 정보 필수
                .build();

        // ❌ [삭제] Repository가 아니라...
        // given(flightRepository.findByFlightNumber(...)).willReturn(...);

        // ✅ [수정] Adaptor가 동작하도록 설정해야 합니다!
        given(flightDBAdaptor.getFlightByFlightNumber("KE001")).willReturn(mockFlight);

        // 4. Mission 저장 Mocking (MissionDBAdaptor)
        Mission mockMission = Mission.builder()
                .id(100L)
                .flight(mockFlight)
                .pilot(mockPilot)
                .status(MissionStatus.WAITING)
                .build();

        // MissionDBAdaptor의 save 호출 시 mockMission 반환
        given(missionDBAdaptor.save(any(Mission.class))).willReturn(mockMission);

        // when (실행)
        missionService.requestTransport(pilotId, request);

        // then (검증)
        // 1. MissionDBAdaptor.save가 호출되었는지 검증 (Repository 아님)
        verify(missionDBAdaptor, times(1)).save(any(Mission.class));

        // 2. MissionDBAdaptor.saveLog가 호출되었는지 검증
        verify(missionDBAdaptor, times(1)).saveLog(any(Mission.class), any(), any());

        // 3. 관제사에게 알림 메서드가 호출되었는지 검증
        verify(webSocketService, times(1)).notifyAdminRequest(any(AdminAlertDto.class));
    }
}