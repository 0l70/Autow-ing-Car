package com.project.global.config;

import com.project.domain.common.CarStatus;
import com.project.domain.common.MapStatus;
import com.project.domain.common.UserRole;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.map.repository.EdgeRepository; // Repository 필요
import com.project.domain.map.repository.NodeRepository; // Repository 필요
import com.project.domain.towingcar.repository.TowingCarRepository; // Repository 필요
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
// @Profile("local") // application-local.yml 활성화 시에만 동작
@RequiredArgsConstructor
public class LocalDataInit implements CommandLineRunner {

    private final PasswordEncoder passwordEncoder;

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    private final UserRepository userRepository;

    @Override
    // @Transactional
    public void run(String... args) throws Exception {
        log.info("############ Local Data Initialization Start ############");

        if (!userRepository.existsByEmployeeCode("P001")) {
            User pilot = User.builder()
                    .email("pilot@atc.com")
                    .password(passwordEncoder.encode("1234")) // 비밀번호: 1234
                    .username("Maverick")
                    .employeeCode("P001")
                    .role(UserRole.PILOT)
                    .build();
            userRepository.save(pilot);
            System.out.println("✅ 초기 데이터 생성: PILOT (email: pilot@atc.com / pw: 1234)");
        }

        // 2. ATC User 생성 (중복 방지 체크)
        if (!userRepository.existsByEmployeeCode("A001")) {
            User atc = User.builder()
                    .email("atc@atc.com")
                    .password(passwordEncoder.encode("1234")) // 비밀번호: 1234
                    .username("TowerControl")
                    .employeeCode("A001")
                    .role(UserRole.ATC)
                    .build();
            userRepository.save(atc);
            System.out.println("✅ 초기 데이터 생성: ATC (email: atc@atc.com / pw: 1234)");
        }

        // 1. Node 데이터 생성
        Node gate101 = createNode("GATE_101", 10.0, 10.0);
        Node gate102 = createNode("GATE_102", 10.0, 20.0);
        Node tw1 = createNode("TW_1", 20.0, 15.0); // Taxiway 1
        Node tw2 = createNode("TW_2", 30.0, 15.0); // Taxiway 2
        Node runway = createNode("RUNWAY_A", 50.0, 50.0);

        List<Node> nodes = List.of(gate101, gate102, tw1, tw2, runway);
        nodeRepository.saveAll(nodes);

        // 2. Edge 데이터 생성 (Node 객체를 연결)
        // Gate -> Taxiway
        createAndSaveEdge("E_G101_TW1", gate101, tw1, 100.0);
        createAndSaveEdge("E_G102_TW1", gate102, tw1, 100.0);

        // Taxiway -> Taxiway
        createAndSaveEdge("E_TW1_TW2", tw1, tw2, 100.0);
        createAndSaveEdge("E_TW2_TW1", tw2, tw1, 100.0); // 양방향 가정

        // Taxiway -> Runway
        createAndSaveEdge("E_TW2_RWY", tw2, runway, 200.0);

        // 3. TowingCar 데이터 생성
        createAndSaveCar("TC01", 10.0, 10.0, 100);
        createAndSaveCar("TC02", 10.0, 20.0, 80);

        // 4. Flight 데이터 생성
        createAndSaveFlight("KE001", userRepository.findByEmail("pilot@atc.com"),
                towingCarRepository.findByCode("TC01"));

        log.info("############ Local Data Initialization Finished ############");
    }

    private Node createNode(String code, double x, double y) {
        return Node.builder()
                .nodeCode(code)
                .posX(x)
                .posY(y)
                .status(MapStatus.AVAILABLE) // Node Entity의 Enum 타입 확인 필요
                .restrictionInfo("NONE")
                .build();
    }

    private void createAndSaveEdge(String code, Node src, Node dst, double distance) {
        Edge edge = Edge.builder()
                .edgeCode(code)
                .srcNode(src)
                .dstNode(dst)
                .distance(distance)
                .status(MapStatus.AVAILABLE) // Edge Entity의 Enum 타입 확인 필요 (AVAILABLE 등)
                .maxSpeed(30)
                .restrictionInfo("NONE")
                .build();
        edgeRepository.save(edge);
    }

    private void createAndSaveCar(String code, double x, double y, int battery) {
        TowingCar car = TowingCar.builder()
                .code(code)
                .carStatus(CarStatus.IDLE)
                .battery(battery)
                .lastPosX(x)
                .lastPosY(y)
                .lastHeading(0.0)
                .build();
        towingCarRepository.save(car);
    }

    private void createAndSaveFlight(String flightNumber, Optional<User> pilot, Optional<TowingCar> towingCar) {
        // Flight 엔티티 생성 및 저장 로직 구현
        Flight flight = Flight.builder()
                .flightNumber(flightNumber)
                .assignedTowingCar(towingCar.orElse(null))
                .pilot(pilot.get())
                .build();
        flightRepository.save(flight);
    }
}