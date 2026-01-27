package com.project.service;

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
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class) // Spring 띄우지 않고 Mockito만 사용 (Fast!)
class MissionServiceTest {

    @InjectMocks
    private MissionService missionService; // 테스트 대상

    // 가짜 객체들 (Mock)
    @Mock private MissionRepository missionRepository;
    @Mock private TowingCarRepository towingCarRepository;
    @Mock private FlightRepository flightRepository;
    @Mock private WebSocketService webSocketService;

    @Mock private MissionLogRepository missionLogRepository; // 이게 없어서 NPE 발생!
    @Mock private MqttOutboundService mqttOutboundService;   // 얘도 필요할 겁니다
    @Mock private ObjectMapper objectMapper;

    @Mock private MissionDBAdaptor missionDBAdaptor;
    @Mock private TowingCarDBAdaptor towingCarReader;
    @Mock private FlightDBAdaptor flightDBAdaptor;

    @Test
    @DisplayName("기장이 미션을 요청하면 -> 저장되고 -> 관제사에게 알림이 가야 한다")
    void createMissionRequestTest() {
        // given (준비)
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
}