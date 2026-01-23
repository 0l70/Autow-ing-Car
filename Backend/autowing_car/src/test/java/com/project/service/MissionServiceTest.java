package com.project.service;

import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.repository.MissionRepository;
import com.project.domain.mission.service.MissionService;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository;
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

    @Test
    @DisplayName("기장이 미션을 요청하면 -> 저장되고 -> 관제사에게 알림이 가야 한다")
    void createMissionRequestTest() {
        // given (준비)
        String pilotId = "PILOT_01";
        PilotRequestDto request = new PilotRequestDto();
        request.setDepartNode("GATE_101");
        request.setDestNode("RUNWAY_A");
        request.setFlightId(1L);

        // Mocking: "이 메서드가 호출되면 이런 값을 리턴해라"라고 설정
        Flight mockFlight = Flight.builder().id(1L).flightNumber("KE001").build();
        given(flightRepository.findById(1L)).willReturn(Optional.of(mockFlight));

        Mission mockMission = Mission.builder().id(100L).status(MissionStatus.WAITING).build();
        given(missionRepository.save(any(Mission.class))).willReturn(mockMission);

        TowingCar idleCar = TowingCar.builder().code("TC01").carStatus(CarStatus.IDLE).battery(90).build();
        given(towingCarRepository.findAllByCarStatus(CarStatus.IDLE)).willReturn(List.of(idleCar));

        // when (실행)
        missionService.createMissionRequest(pilotId, request);

        // then (검증)
        // 1. 미션이 저장을 위해 호출되었는가?
        verify(missionRepository, times(1)).save(any(Mission.class));
        
        // 2. 관제사에게 알림 메서드가 호출되었는가? (핵심 로직 검증)
        verify(webSocketService, times(1)).notifyAdminRequest(any(AdminAlertDto.class));
    }
}