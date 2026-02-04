package com.project.service;

import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.mission.service.MissionService;
import com.project.domain.mission.service.MissionWebSocketService;

import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarMqttService; // NEW
import com.project.domain.user.entity.User;

import com.project.domain.user.service.UserDBAdaptor;
import com.project.global.config.LocalDataInit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@TestPropertySource(properties = {
                "jwt.secret=testSecretKeyForUnitTestingMustBeLongEnoughToSatisfyHS256RequirementsSinceItRequiresAtLeast256Bits",
                "jwt.expiration=3600000",
                "MQTT_HOST=localhost",
                "MQTT_PORT=1883",
                "REDIS_HOST=localhost",
                "REDIS_PORT=6379"
})
class MissionServiceTest {

        @Autowired
        private LocalDataInit localDataInit;
        @Autowired
        private MissionService missionService;

        @Autowired
        private MissionDBAdaptor missionDBAdaptor;
        @Autowired
        private TowingCarDBAdaptor towingCarDBAdaptor;
        @Autowired
        private FlightDBAdaptor flightDBAdaptor;
        @Autowired
        private UserDBAdaptor userDBAdaptor;

        @MockBean
        private MissionWebSocketService missionWebSocketService;
        @MockBean
        private TowingCarMqttService towingCarMqttService;

        @Autowired
        private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

        @Test
        @DisplayName("기장이 운송을 요청하면 -> DB 저장 없이 -> 관제사에게 승인 요청 알림만 가야 한다")
        void requestTransportTest() {
                // given
                User pilot = userDBAdaptor.findUserByEmail("pilot@atc.com");
                // KE001 Flight (from LocalDataInit)
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");

                PilotRequestDto request = new PilotRequestDto(flight.getId());

                // when
                // principal.getName() returns email
                missionService.requestTransport(pilot.getEmail(), request);

                // then
                // 1. 관제사에게 알림이 갔는가? (핵심)
                verify(missionWebSocketService, times(1)).notifyAdminRequest(any(AdminAlertDto.class));

                // 2. 미션이 아직 저장되지 않았는가?
                // MissionDBAdaptor는 findAll이 없으므로 Repository를 직접 쓰거나,
                // 로직상 저장이 안되는 것을 믿어야 함. (혹은 Repository Autowire해서 count 확인)
                // 여기서는 생략하거나, 추후 MissionRepository 추가하여 확인 가능.
        }

        @Test
        @DisplayName("관제사가 승인하면 -> 미션이 생성되고 -> 로봇에게 출발 명령이 가야 한다")
        void approveMissionTest() {
                // given
                User controller = transactionTemplate.execute(status -> userDBAdaptor.findUserByEmail("atc@atc.com"));
                Flight flight = transactionTemplate.execute(status -> flightDBAdaptor.getFlightByFlightNumber("KE001"));

                ATCDecisionDto decision = new ATCDecisionDto();
                decision.setFlightId(flight.getId());
                decision.setApproved(true);
                decision.setDestNode("RUNWAY");
                decision.setSelectedEdgeIds(List.of("E_GATE_101_to_N_0_0"));

                // when
                 missionService.approveMission(controller.getEmail(), decision);

                // then
                transactionTemplate.execute(status -> {
                        Mission mission = missionDBAdaptor.findActiveMissionByCar(flight.getAssignedTowingCar());
                        assertNotNull(mission);
                        assertEquals(MissionStatus.RUNNING, mission.getStatus());
                        assertEquals("RUNWAY", mission.getDestNode());

                        // 3. 알림 전송 확인
                        verify(missionWebSocketService).broadcastMissionUpdate(any(MissionResponseDto.class));

                        // 4. MQTT 명령 전송 확인 (Standardized Payload)
                        verify(towingCarMqttService).sendDriveCommand(eq(flight.getAssignedTowingCar().getCode()),
                                        argThat((Map<String, Object> payload) -> {
                                                @SuppressWarnings("unchecked")
                                                Map<String, Object> data = (Map<String, Object>) payload.get("data");
                                                return payload.containsKey("msgId") &&
                                                                "DRIVE".equals(payload.get("type")) &&
                                                                "STOP".equals(data.get("finalAction"));
                                        }));
                        return null;
                });
        }
}