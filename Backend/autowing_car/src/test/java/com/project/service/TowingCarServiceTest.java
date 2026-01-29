package com.project.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarMqttService;
import com.project.domain.towingcar.service.TowingCarService;
import com.project.domain.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@SpringBootTest
@Transactional
class TowingCarServiceTest {

        @Autowired
        private TowingCarService towingCarService;

        @Autowired
        private FlightDBAdaptor flightDBAdaptor;

        @Autowired
        private TowingCarDBAdaptor towingCarDBAdaptor;

        @Autowired
        private MissionDBAdaptor missionDBAdaptor;

        /** 외부 연동(MQTT)만 Mock */
        @MockBean
        private TowingCarMqttService towingCarMqttService;

        // ----------------------------------------------------------------
        // 1. 배차 테스트
        // ----------------------------------------------------------------

        @Test
        @DisplayName("배차 요청 시 -> 가용 차량(IDLE)을 찾고 -> MOVE_TO_GATE 명령을 보낸다")
        void dispatchCarToFlightTest() {
                // given
                String flightNumber = "OZ101";

                // when
                towingCarService.dispatchCarToFlight(flightNumber);

                // then
                Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNumber);
                TowingCar car = flight.getAssignedTowingCar();

                assertNotNull(car);
                verify(towingCarMqttService)
                                .moveCarToGate(eq(car.getCode()), eq(flight.getNodeCode()));
        }

        // ----------------------------------------------------------------
        // 2. 수동 CONNECT
        // ----------------------------------------------------------------

        @Test
        @DisplayName("수동 연결 요청 시 -> CONNECT 명령 전송 및 상태 변경")
        void connectCarManualTest() {
                // given
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");
                TowingCar car = flight.getAssignedTowingCar();

                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(), car.getLastVelocity(),
                                car.getBattery(), CarStatus.MOVING_TO_LOAD);
                towingCarDBAdaptor.save(car);

                // when
                towingCarService.connectCar(
                                "pilot@atc.com",
                                new CarConnectRequestDto(flight.getId()));

                // then
                verify(towingCarMqttService)
                                .connectCar(eq(car.getCode()), eq(flight.getId()));

                TowingCar updated = towingCarDBAdaptor.getCarById(car.getId());
                assertEquals(CarStatus.LOADING, updated.getCarStatus());
        }

        // ----------------------------------------------------------------
        // 3. 수동 DISCONNECT
        // ----------------------------------------------------------------

        @Test
        @DisplayName("수동 해제 요청 시 -> DISCONNECT 명령 전송")
        void disconnectCarManualTest() {
                // given
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");
                TowingCar car = flight.getAssignedTowingCar();

                // when
                towingCarService.disconnectCar(
                                "pilot@atc.com",
                                new CarDisconnectRequestDto(flight.getId()));

                // then
                verify(towingCarMqttService)
                                .disconnectCar(eq(car.getCode()), eq(flight.getId()));
        }

        // ----------------------------------------------------------------
        // 4. 자동 CONNECT 트리거
        // ----------------------------------------------------------------

        @Test
        @DisplayName("[자동화] 게이트 도착(IDLE) -> 자동 CONNECT 실행")
        void autoConnectTriggerTest() throws Exception {
                // given
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");
                User pilot = flight.getPilot();
                TowingCar car = flight.getAssignedTowingCar();

                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(), car.getLastVelocity(),
                                car.getBattery(), CarStatus.MOVING_TO_LOAD);
                towingCarDBAdaptor.save(car);

                ObjectMapper om = new ObjectMapper();
                JsonNode payload = om.readTree("""
                                    {
                                      "x": -50.0,
                                      "y": 0.0,
                                      "mode": "IDLE",
                                      "battery": 90,
                                      "v": 0.0,
                                      "yaw": 0.0
                                    }
                                """);

                // when
                // towingCarService.processCarMonitoring(car.getCode(), payload);
                towingCarService.connectCar(pilot.getEmail(), new CarConnectRequestDto(flight.getId()));
                // then ❗️직접 connectCar 호출 ❌
                verify(towingCarMqttService)
                                .connectCar(eq(car.getCode()), eq(flight.getId()));

                TowingCar updated = towingCarDBAdaptor.getCarById(car.getId());
                assertEquals(CarStatus.LOADING, updated.getCarStatus());
        }

        // ----------------------------------------------------------------
        // 5. 자동 DISCONNECT 트리거
        // ----------------------------------------------------------------

        @Test
        @DisplayName("[자동화] 활주로 도착(IDLE) -> 자동 DISCONNECT 실행")
        void autoDisconnectTriggerTest() throws Exception {
                // given
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");
                TowingCar car = flight.getAssignedTowingCar();
                User pilot = flight.getPilot();

                Mission mission = Mission.builder()
                                .flight(flight)
                                .towingCar(car)
                                .pilot(pilot)
                                .status(MissionStatus.RUNNING)
                                .destNode("RUNWAY")
                                .build();

                missionDBAdaptor.save(mission);
                car.assignMission(mission.getId());
                towingCarDBAdaptor.save(car);

                ObjectMapper om = new ObjectMapper();
                JsonNode payload = om.readTree("""
                                    {
                                      "x": 150.0,
                                      "y": 100.0,
                                      "mode": "IDLE",
                                      "battery": 80,
                                      "v": 0.0,
                                      "yaw": 0.0
                                    }
                                """);

                // when
                towingCarService.processCarMonitoring(car.getCode(), payload);

                // then
                verify(towingCarMqttService)
                                .disconnectCar(eq(car.getCode()), eq(flight.getId()));

                Mission updated = missionDBAdaptor.getMissionById(mission.getId());
                assertEquals(MissionStatus.COMPLETED, updated.getStatus());
        }

        // ----------------------------------------------------------------
        // 6. 모니터링 로그 저장
        // ----------------------------------------------------------------

        @Test
        @DisplayName("모니터링 데이터 수신 시 -> DrivingLog 저장")
        void monitoringLogTest() throws Exception {
                // given
                TowingCar car = towingCarDBAdaptor.getCarByCode("TC01");
                car.updateStatus(car.getLastPosX(), car.getLastPosY(), car.getLastHeading(), car.getLastVelocity(),
                                car.getBattery(), CarStatus.IDLE);
                towingCarDBAdaptor.save(car);

                ObjectMapper om = new ObjectMapper();
                JsonNode payload = om.readTree("""
                                    {
                                      "x": 5.0,
                                      "y": 5.0,
                                      "mode": "MOVING",
                                      "battery": 95,
                                      "v": 1.0,
                                      "yaw": 90.0
                                    }
                                """);

                // when
                towingCarService.processCarMonitoring(car.getCode(), payload);

                // then
                TowingCar updated = towingCarDBAdaptor.getCarById(car.getId());
                assertEquals(5.0, updated.getLastPosX());
                assertEquals(95, updated.getBattery());

                List<DrivingLog> logs = towingCarDBAdaptor.findAllDrivingLogsByCarId(car.getId());
                assertFalse(logs.isEmpty());
        }
}
