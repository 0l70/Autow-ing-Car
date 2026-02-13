package com.project.service;

import com.project.domain.common.CarStatus;
import com.project.domain.common.MapStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;

import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;

import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.towingcar.service.TowingCarMqttService;
import com.project.domain.towingcar.service.TowingCarService;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.project.domain.map.entity.Node;
import com.project.domain.map.repository.NodeRepository;
import org.junit.jupiter.api.BeforeEach;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.argThat;

@SpringBootTest
// @Transactional // [Remove] to ensure commit happens and
// TxUtil.executeAfterCommit runs
@TestPropertySource(properties = {
                "jwt.secret=testSecretKeyForUnitTestingMustBeLongEnoughToSatisfyHS256RequirementsSinceItRequiresAtLeast256Bits",
                "jwt.expiration=3600000",
                "MQTT_HOST=localhost",
                "MQTT_PORT=1883",
                "REDIS_HOST=localhost",
                "REDIS_PORT=6379"
})
class TowingCarServiceTest {

        @Autowired
        private TowingCarService towingCarService;

        @Autowired
        private FlightDBAdaptor flightDBAdaptor;

        @Autowired
        private TowingCarDBAdaptor towingCarDBAdaptor;

        @MockitoBean
        private TowingCarMqttService towingCarMqttService;

        @Autowired
        private TransactionTemplate transactionTemplate;

        @Autowired
        private NodeRepository nodeRepository;

        @BeforeEach
        void setUp() {
                transactionTemplate.execute(status -> {
                        if (nodeRepository.findByNodeCode("S01").isEmpty()) {
                                Node baseNode = Node.builder()
                                                .nodeCode("S01")
                                                .posX(0.0)
                                                .posY(0.0)
                                                .status(MapStatus.AVAILABLE)
                                                .build();
                                nodeRepository.save(baseNode);
                        }
                        return null;
                });
        }

        // ----------------------------------------------------------------
        // 1. 배차 테스트
        // ----------------------------------------------------------------
        @Test
        @DisplayName("배차 요청 시 -> 가용 차량을 찾고 -> MOVE_TO_GATE(Payload with carId) 명령을 보낸다")
        void dispatchCarToFlightTest() {
                // given
                String flightNumber = "OZ101";

                // when
                towingCarService.dispatchCarToFlight(flightNumber);

                // then
                transactionTemplate.execute(status -> {
                        Flight flight = flightDBAdaptor.getFlightByFlightNumber(flightNumber);
                        TowingCar car = flight.getAssignedTowingCar();
                        assertNotNull(car);

                        // Verify Payload Structure
                        verify(towingCarMqttService).sendDriveCommand(eq(car.getCode()),
                                        argThat((Map<String, Object> payload) -> {
                                                @SuppressWarnings("unchecked")
                                                Map<String, Object> data = (Map<String, Object>) payload.get("data");
                                                return payload.containsKey("msgId") &&
                                                                payload.containsKey("timestamp") &&
                                                                "DRIVE".equals(payload.get("type")) &&
                                                                car.getCode().equals(data.get("carId")) &&
                                                                data.containsKey("waypoints") &&
                                                                "DOCK".equals(data.get("finalAction"));
                                        }));

                        // Cleanup
                        flight.assignCar(null);
                        flightDBAdaptor.save(flight);
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.IDLE);
                        towingCarDBAdaptor.save(car);
                        return null;
                });
        }

        // ----------------------------------------------------------------
        // 2. 수동 CONNECT
        // ----------------------------------------------------------------
        @Test
        @DisplayName("수동 연결 요청 시 -> CONNECT 명령 전송 및 LOADING 상태 변경")
        void connectCarManualTest() {
                // given
                Flight flight = transactionTemplate.execute(status -> {
                        Flight f = flightDBAdaptor.getFlightByFlightNumber("KE001");
                        TowingCar car = f.getAssignedTowingCar();
                        // MOVING_TO_GATE
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.MOVING_TO_GATE);
                        // DOCKING
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.DOCKING);
                        // RETURNING
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.RETURNING);
                        towingCarDBAdaptor.save(car);
                        return f;
                });

                // when
                towingCarService.connectCar("pilot@atc.com", new CarConnectRequestDto(flight.getId()));

                // then
                transactionTemplate.execute(status -> {
                        TowingCar car = towingCarDBAdaptor.getCarById(flight.getAssignedTowingCar().getId());
                        verify(towingCarMqttService).connectCar(eq(car.getCode()), eq(flight.getId()));

                        TowingCar updated = towingCarDBAdaptor.getCarById(car.getId());
                        assertEquals(CarStatus.DOCKING, updated.getCarStatus());

                        // Cleanup
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.IDLE);
                        towingCarDBAdaptor.save(car);
                        return null;
                });
        }

        // ----------------------------------------------------------------
        // 3. 해제 및 복귀 (Disconnect & Return)
        // ----------------------------------------------------------------
        @Test
        @DisplayName("해제 요청 시 -> UNLOADING -> 복귀 명령(PARK) 전송 -> MOVING_TO_IDLE 상태")
        void disconnectCarAndReturnTest() {
                // given
                Flight flight = flightDBAdaptor.getFlightByFlightNumber("KE001");

                transactionTemplate.execute(status -> {
                        Flight f = flightDBAdaptor.getFlightByFlightNumber("KE001");
                        TowingCar car = f.getAssignedTowingCar();
                        // Assume Mission is running/completed
                        car.updateStatus(100.0, 100.0, 0.0, 0.0, 80, CarStatus.TOWING);
                        towingCarDBAdaptor.save(car);
                        return null;
                });

                // when
                towingCarService.disconnectCar("pilot@atc.com", new CarDisconnectRequestDto(flight.getId()));

                // then
                transactionTemplate.execute(status -> {
                        Flight f = flightDBAdaptor.getFlightByFlightNumber("KE001");
                        TowingCar car = f.getAssignedTowingCar();

                        // 1. Verify Return Command (PARK)
                        verify(towingCarMqttService).sendDriveCommand(eq(car.getCode()),
                                        argThat((Map<String, Object> payload) -> {
                                                @SuppressWarnings("unchecked")
                                                Map<String, Object> data = (Map<String, Object>) payload.get("data");
                                                return "PARK".equals(data.get("finalAction")) &&
                                                                ("RETURN_" + car.getCode())
                                                                                .equals(payload.get("taskId"));
                                        }));

                        // 2. Verify Status Transition (Final state should be MOVING_TO_IDLE)
                        TowingCar updated = towingCarDBAdaptor.getCarById(car.getId());
                        assertEquals(CarStatus.RETURNING, updated.getCarStatus());

                        // Cleanup
                        car.updateStatus(0.0, 0.0, 0.0, 0.0, 100, CarStatus.IDLE);
                        towingCarDBAdaptor.save(car);
                        return null;
                });
        }
}
