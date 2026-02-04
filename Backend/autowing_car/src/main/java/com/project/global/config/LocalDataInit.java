package com.project.global.config;

import com.project.domain.aircraft.entity.Aircraft;
import com.project.domain.aircraft.repository.AircraftRepository;
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
import com.project.global.util.RdpSimplifier;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 프로젝트 로컬 환경을 위한 초기 데이터 설정을 담당하는 클래스
 * 사용자, 항공기, 지도 노드/간선, 차량, 비행 스케줄 등을 초기화합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalDataInit implements CommandLineRunner {

    private final PasswordEncoder passwordEncoder;

    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    private final UserRepository userRepository;
    private final AircraftRepository aircraftRepository;
    private final ObjectMapper objectMapper;

    @Override
    public void run(String... args) {
        log.info("############ Local Data Initialization Start ############");

        // 1. 사용자 초기화 (P001: 기장, A001: 관제사)
        User pilot = initUser("P001", "Maverick", "pilot@atc.com", "1234", UserRole.PILOT);
        User atc = initUser("A001", "TowerControl", "atc@atc.com", "1234", UserRole.ATC);

        // 2. 항공기 초기화 (B737, A320)
        Aircraft b737 = initAircraft("HL7777", "B737", 35.0, 39.0);
        Aircraft a320 = initAircraft("HL8888", "A320", 34.0, 37.0);

        // // Edges: Horizontal & Vertical (Bi-directional)
        // for (int i = 0; i < 3; i++) {
        // for (int j = 0; j < 3; j++) {
        // // Horizontal (to Right)
        // if (i < 2) {
        // createAndSaveBiEdge(grid[i][j], grid[i + 1][j], 50.0 + i * 13 + j * 1);
        // }
        // // Vertical (to Bottom)
        // if (j < 2) {
        // createAndSaveBiEdge(grid[i][j], grid[i][j + 1], 50.0 + i * 12 + j * 2);
        // }
        // }
        // }

        // // Special Nodes: GATE & RUNWAY
        // Node gate = createNode("G101", -50.0, 0.0);
        // Node runway = createNode("R101", 150.0, 100.0);

        // 3. 지도 데이터 초기화 (PathPlanner 기반 노드 및 간선 생성)
        Node s01 = createNode("S01", -1.22, -0.13); // 시작 노드
        Node g01 = createNode("G01", 0.33, -0.28); // 중간 게이트 노드
        Node r02 = createNode("R02", 4.03, -0.08); // 활주로 인근 노드
        nodeRepository.saveAll(List.of(s01, g01, r02));

        // 경로 좌표 JSON 파일을 읽어 간선(Edge)의 보조점(Waypoints)으로 저장
        importPathCoordinates("edge01",
                "../../embedded/PathPlanner/maps/edge01/paths/path_S01_to_G01_20260202_173003.json", s01, g01, 1.56);
        importPathCoordinates("edge02",
                "../../embedded/PathPlanner/maps/edge02/paths/path_S02_to_G02_20260202_180927.json", g01, r02, 3.70);

        // 4. 차량(Towing Car) 초기화
        TowingCar tc1 = createAndSaveCar("TC01", -1.22, -0.13, 100);
        TowingCar tc2 = createAndSaveCar("TC02", 0.33, -0.28, 90);

        // 5. 비행 정보 및 스케줄 초기화
        createAndSaveFlight("KE001", pilot, tc1, b737);
        createAndSaveFlight("OZ101", pilot, tc2, a320);

        log.info("############ Local Data Initialization Finished ############");
    }

    // --- Helper Methods ---

    private User initUser(String code, String name, String email, String pwd, UserRole role) {
        if (userRepository.existsByEmployeeCode(code))
            return userRepository.findByEmployeeCode(code).get();
        User user = User.builder()
                .employeeCode(code).username(name).email(email)
                .password(passwordEncoder.encode(pwd)).role(role)
                .build();
        return userRepository.save(user);
    }

    private Aircraft initAircraft(String regNum, String type, double w, double l) {
        if (aircraftRepository.findByRegistrationNum(regNum).isPresent())
            return aircraftRepository.findByRegistrationNum(regNum).get();
        return aircraftRepository.save(Aircraft.builder()
                .registrationNum(regNum).typeCode(type).width(w).length(l).build());
    }

    private Node createNode(String code, double x, double y) {
        return Node.builder()
                .nodeCode(code).posX(x).posY(y)
                .status(MapStatus.AVAILABLE).restrictionInfo("NONE").build();
    }

    private void createAndSaveBiEdge(Node n1, Node n2, double dist) {
        createAndSaveEdge("E_" + n1.getNodeCode() + "_to_" + n2.getNodeCode(), n1, n2, dist);
        createAndSaveEdge("E_" + n2.getNodeCode() + "_to_" + n1.getNodeCode(), n2, n1, dist);
    }

    private void createAndSaveEdge(String code, Node src, Node dst, double distance) {
        Edge edge = Edge.builder()
                .edgeCode(code).srcNode(src).dstNode(dst)
                .distance(distance).status(MapStatus.AVAILABLE).maxSpeed(30).restrictionInfo("NONE").build();
        edgeRepository.save(edge);
    }

    private TowingCar createAndSaveCar(String code, double x, double y, int battery) {
        TowingCar car = TowingCar.builder()
                .code(code).carStatus(CarStatus.IDLE).battery(battery)
                .lastPosX(x).lastPosY(y).lastHeading(0.0).build();
        return towingCarRepository.save(car);
    }

    private void createAndSaveFlight(String flightNumber, User pilot, TowingCar car,
            Aircraft aircraft) {
        Flight flight = Flight.builder()
                .flightNumber(flightNumber)
                .towingCar(car) // Default assignment
                .assignedTowingCar(car) // Initial assignment
                .pilot(pilot)
                .aircraft(aircraft)
                .nodeCode("G01")
                .departureDate(LocalDate.now())
                .scheduledTime(LocalDateTime.now().plusHours(2))
                .build();
        flightRepository.save(flight);
    }

    /**
     * PathPlanner에서 생성한 경로 좌표 파일(x, y 배열)을 읽어 간선 보조점으로 저장합니다.
     */
    private void importPathCoordinates(String prefix, String filePath, Node startNode, Node endNode, double distance) {
        try {
            java.io.File file = new java.io.File(filePath);
            log.info("[LocalDataInit] Looking for path file at: {}", file.getAbsolutePath());
            if (!file.exists()) {
                log.warn("[LocalDataInit] Path file not found: {}", file.getAbsolutePath());
                return;
            }

            JsonNode root = objectMapper.readTree(file);
            JsonNode xArray = root.get("x");
            JsonNode yArray = root.get("y");

            List<RdpSimplifier.Point> rawPoints = new ArrayList<>();
            for (int i = 0; i < xArray.size(); i++) {
                rawPoints.add(new RdpSimplifier.Point(xArray.get(i).asDouble(), yArray.get(i).asDouble()));
            }

            log.info("[LocalDataInit] Loaded {} raw path points for {}", rawPoints.size(), prefix);

            // RDP 알고리즘으로 좌표 단순화 (70개 → 20~30개)
            List<RdpSimplifier.Point> simplified = RdpSimplifier.simplify(rawPoints, 0.1);
            log.info("[LocalDataInit] Simplified {} -> {} points for {}", rawPoints.size(), simplified.size(), prefix);

            // Convert simplified points to JSON
            String waypointsJson = objectMapper.writeValueAsString(simplified);

            // Create Bi-directional Edges with waypoints
            saveEdgeWithWaypoints("E_" + startNode.getNodeCode() + "_to_" + endNode.getNodeCode(), startNode, endNode,
                    distance, waypointsJson);

            // For reverse edge, reverse the waypoints list
            List<RdpSimplifier.Point> reversed = new ArrayList<>(simplified);
            java.util.Collections.reverse(reversed);
            String reversedWaypointsJson = objectMapper.writeValueAsString(reversed);
            saveEdgeWithWaypoints("E_" + endNode.getNodeCode() + "_to_" + startNode.getNodeCode(), endNode, startNode,
                    distance, reversedWaypointsJson);

        } catch (Exception e) {
            log.error("[LocalDataInit] Failed to import path {}: {}", prefix, e.getMessage());
        }
    }

    private void saveEdgeWithWaypoints(String code, Node src, Node dst, double distance, String waypoints) {
        Edge edge = Edge.builder()
                .edgeCode(code).srcNode(src).dstNode(dst)
                .distance(distance).status(MapStatus.AVAILABLE).maxSpeed(30).restrictionInfo("NONE")
                .waypoints(waypoints)
                .build();
        edgeRepository.save(edge);
    }

    private List<Node> flatten(Node[][] grid) {
        List<Node> list = new java.util.ArrayList<>();
        for (Node[] row : grid) {
            for (Node n : row)
                list.add(n);
        }
        return list;
    }
}