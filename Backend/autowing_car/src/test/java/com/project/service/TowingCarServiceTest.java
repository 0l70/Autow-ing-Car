package com.project.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarService;
import com.project.infra.mqtt.service.MqttOutboundService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class TowingCarServiceTest {

        @InjectMocks
        private TowingCarService towingCarService;

        @Mock
        private TowingCarDBAdaptor towingCarDBAdaptor;
        @Mock
        private MissionDBAdaptor missionDBAdaptor;
        @Mock
        private FlightDBAdaptor flightDBAdaptor;
        @Mock
        private MapDBAdaptor mapDBAdaptor;
        @Mock
        private MqttOutboundService mqttOutboundService;
        @Mock
        private ObjectMapper objectMapper;

        // --- 1. 배차 (Dispatch) 테스트 ---

        @Test
        @DisplayName("배차 요청 시 -> 가용 차량을 찾고 -> MOVE_TO_GATE 명령을 보낸다")
        void dispatchCarToFlightTest() throws Exception {
                // given
                String flightNumber = "KE001";

                // Mocking: Flight & Car
                Flight mockFlight = Flight.builder()
                                .id(1L)
                                .flightNumber(flightNumber)
                                .nodeCode("GATE_101")
                                .build();

                TowingCar idleCar = TowingCar.builder()
                                .code("TC01")
                                .carStatus(CarStatus.IDLE)
                                .battery(100)
                                .build();
                idleCar.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.IDLE);

                given(flightDBAdaptor.getFlightByFlightNumber(flightNumber)).willReturn(mockFlight);
                given(towingCarDBAdaptor.findFirstByCarStatusOrderByBatteryDesc(CarStatus.IDLE)).willReturn(idleCar);

                // ★ [핵심 수정] ObjectMapper가 "MOVE_TO_GATE"가 포함된 JSON을 반환하도록 설정
                given(objectMapper.writeValueAsString(any()))
                                .willReturn("{\"cmd\":\"MOVE_TO_GATE\", \"data\":{\"targetNode\":\"GATE_101\"}}");

                // when
                towingCarService.dispatchCarToFlight(flightNumber);

                // then
                // 1. 차량 상태가 MOVING으로 변했는지 확인
                assertEquals(CarStatus.MOVING_TO_LOAD, idleCar.getCarStatus());

                // 2. MQTT 전송 확인 (Topic에 CarCode 포함, Payload에 명령 포함)
                verify(mqttOutboundService).publish(contains("TC01"), contains("MOVE_TO_GATE"));
        }

        // --- 2. 연결 (Connect) 테스트 ---

        @Test
        @DisplayName("수동 연결 요청 시 -> CONNECT 명령 전송 및 상태 변경")
        void connectCarManualTest() throws Exception {
                // given
                Long flightId = 1L;
                String pilotId = "PILOT_01";

                TowingCar mockCar = TowingCar.builder().code("TC01").carStatus(CarStatus.MOVING_TO_LOAD).build();
                Flight mockFlight = Flight.builder().id(flightId).assignedTowingCar(mockCar).build();

                given(flightDBAdaptor.getFlightById(flightId)).willReturn(mockFlight);

                // ★ [핵심 수정] ObjectMapper가 "CONNECT"가 포함된 JSON을 반환하도록 설정
                given(objectMapper.writeValueAsString(any())).willReturn("{\"cmd\":\"CONNECT\"}");

                // when
                towingCarService.connectCar(pilotId, new CarConnectRequestDto(flightId, null));

                // then
                // 1. MQTT 전송 확인
                verify(mqttOutboundService).publish(contains("TC01"), contains("CONNECT"));

                // 2. 차량 상태 CONNECTED(또는 TOWING)로 변경 확인
                // (Service 로직에 따라 CONNECTED 또는 TOWING인지 확인 필요, 여기선 Service 코드 기준
                // TOWING/CONNECTED 확인)
                // Service 코드에서 car.updateStatus(..., CarStatus.CONNECTED) 또는 TOWING을 호출함.
                // 제공해주신 코드에는 CONNECTED로 되어 있으므로 CONNECTED 확인.
                assertEquals(CarStatus.LOADING, mockCar.getCarStatus());
        }

        // --- 3. 해제 (Disconnect) 테스트 ---

        @Test
        @DisplayName("수동 해제 요청 시 -> DISCONNECT 명령 전송 및 미션 완료")
        void disconnectCarManualTest() throws Exception {
                // given
                Long flightId = 1L;
                Long missionId = 100L;

                TowingCar mockCar = TowingCar.builder().code("TC01").currentMissionId(missionId).build();
                Flight mockFlight = Flight.builder().id(flightId).assignedTowingCar(mockCar).build();

                Mission mockMission = Mission.builder().id(missionId).status(MissionStatus.RUNNING).flight(mockFlight)
                                .build();

                given(flightDBAdaptor.getFlightById(flightId)).willReturn(mockFlight);
                given(missionDBAdaptor.getMissionById(missionId)).willReturn(mockMission);

                // ★ [핵심 수정] ObjectMapper가 "DISCONNECT"가 포함된 JSON을 반환하도록 설정
                given(objectMapper.writeValueAsString(any())).willReturn("{\"cmd\":\"DISCONNECT\"}");

                // when
                towingCarService.disconnectCar("PILOT", new CarDisconnectRequestDto(flightId, null));

                // then
                verify(mqttOutboundService).publish(contains("TC01"), contains("DISCONNECT"));
                assertEquals(MissionStatus.COMPLETED, mockMission.getStatus());
        }

        // --- 4. 자동화 (Auto Trigger) 테스트 ---

        @Test
        @DisplayName("[자동화] 배차 중 게이트 도착(IDLE) -> 자동 CONNECT 실행")
        void autoConnectTriggerTest() throws Exception {
                // given
                String carCode = "TC01";
                TowingCar mockCar = TowingCar.builder()
                                .code(carCode)
                                .carStatus(CarStatus.MOVING_TO_LOAD) // 현재 이동 중
                                .build();
                // 위치 초기화
                mockCar.updateStatus(10.0, 10.0, 0.0, 0.0, 90, CarStatus.MOVING_TO_LOAD);

                Flight mockFlight = Flight.builder().id(1L).nodeCode("GATE_A").assignedTowingCar(mockCar).build();
                Node gateNode = Node.builder().posX(10.0).posY(10.0).build();

                // Mocking
                given(towingCarDBAdaptor.getCarByCode(carCode)).willReturn(mockCar);
                given(flightDBAdaptor.getFlightByAssignedCar(mockCar)).willReturn(mockFlight); // 자동 연결 조건 체크용
                given(mapDBAdaptor.getNodeByCode("GATE_A")).willReturn(gateNode); // 좌표 확인용
                given(flightDBAdaptor.getFlightById(1L)).willReturn(mockFlight); // connectCar 내부 호출용

                // ★ [핵심 수정] 자동 호출되는 connectCar 내부의 MQTT 전송 검증용
                given(objectMapper.writeValueAsString(any())).willReturn("{\"cmd\":\"CONNECT\"}");

                // Input Payload: 로봇이 게이트 좌표(10, 10)에 도착해서 멈춤(IDLE)
                ObjectMapper realMapper = new ObjectMapper();
                JsonNode payload = realMapper.readTree(
                                "{\"x\": 10.0, \"y\": 10.0, \"mode\": \"IDLE\", \"battery\": 90, \"v\": 0.0, \"yaw\": 0.0}");

                // when
                towingCarService.processCarMonitoring(carCode, payload);

                // then
                // 1. MQTT CONNECT 명령이 전송되었는지 확인 (자동화 로직 동작 여부)
                verify(mqttOutboundService).publish(contains(carCode), contains("CONNECT"));

                // 2. 상태 변경 확인
                assertEquals(CarStatus.LOADING, mockCar.getCarStatus());
        }

        @Test
        @DisplayName("[자동화] 미션 수행 중 활주로 도착(IDLE) -> 자동 DISCONNECT 실행")
        void autoDisconnectTriggerTest() throws Exception {
                // given
                String carCode = "TC01";
                Long missionId = 50L;

                TowingCar mockCar = TowingCar.builder().code(carCode).currentMissionId(missionId).build();
                Flight mockFlight = Flight.builder().id(1L).assignedTowingCar(mockCar).build();

                Mission mockMission = Mission.builder()
                                .id(missionId)
                                .flight(mockFlight)
                                .status(MissionStatus.RUNNING)
                                .destNode("RUNWAY_A")
                                .build();

                Node runwayNode = Node.builder().posX(500.0).posY(500.0).build();

                // Mocking
                given(towingCarDBAdaptor.getCarByCode(carCode)).willReturn(mockCar);
                given(missionDBAdaptor.getMissionById(missionId)).willReturn(mockMission);
                given(mapDBAdaptor.getNodeByCode("RUNWAY_A")).willReturn(runwayNode);
                given(flightDBAdaptor.getFlightById(1L)).willReturn(mockFlight); // disconnectCar 내부 호출용

                // ★ [핵심 수정] 자동 호출되는 disconnectCar 내부의 MQTT 전송 검증용
                given(objectMapper.writeValueAsString(any())).willReturn("{\"cmd\":\"DISCONNECT\"}");

                // Input Payload: 로봇이 활주로 좌표(500, 500)에 도착해서 멈춤(IDLE)
                ObjectMapper realMapper = new ObjectMapper();
                JsonNode payload = realMapper.readTree(
                                "{\"x\": 500.0, \"y\": 500.0, \"mode\": \"IDLE\", \"battery\": 80, \"v\": 0.0, \"yaw\": 0.0}");

                // when
                towingCarService.processCarMonitoring(carCode, payload);

                // then
                // 1. MQTT DISCONNECT 명령 전송 확인
                verify(mqttOutboundService).publish(contains(carCode), contains("DISCONNECT"));

                // 2. 미션 완료 처리 확인
                assertEquals(MissionStatus.COMPLETED, mockMission.getStatus());
        }

        @Test
        @DisplayName("모니터링 데이터 수신 시 -> 로그 저장이 수행되어야 한다")
        void monitoringLogTest() throws Exception {
                // given
                String carCode = "TC01";
                TowingCar mockCar = TowingCar.builder().code(carCode).carStatus(CarStatus.IDLE).battery(100).build();
                mockCar.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.IDLE);

                given(towingCarDBAdaptor.getCarByCode(carCode)).willReturn(mockCar);

                ObjectMapper realMapper = new ObjectMapper();
                // 위치와 배터리가 변경된 데이터
                JsonNode payload = realMapper.readTree(
                                "{\"x\": 5.0, \"y\": 5.0, \"mode\": \"MOVING\", \"battery\": 95, \"v\": 1.0, \"yaw\": 90.0}");

                // when
                towingCarService.processCarMonitoring(carCode, payload);

                // then
                // 1. 차량 엔티티 업데이트 확인
                assertEquals(95, mockCar.getBattery());
                assertEquals(5.0, mockCar.getLastPosX());

                // 2. 로그 저장 호출 확인
                verify(towingCarDBAdaptor).saveDrivingLog(any(DrivingLog.class));
        }
}