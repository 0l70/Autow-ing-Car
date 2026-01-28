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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

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

    @Override
    public void run(String... args) throws Exception {
        log.info("############ Local Data Initialization Start ############");

        // 1. Users
        User pilot = initUser("P001", "Maverick", "pilot@atc.com", "1234", UserRole.PILOT);
        User atc = initUser("A001", "TowerControl", "atc@atc.com", "1234", UserRole.ATC);

        // 2. Aircrafts
        Aircraft b737 = initAircraft("HL7777", "B737", 35.0, 39.0);
        Aircraft a320 = initAircraft("HL8888", "A320", 34.0, 37.0);

        // 3. Map (3x3 Grid for Yen's Algorithm Test)
        // Nodes: (0,0) ~ (2,2)
        // N_x_y naming convention
        Node[][] grid = new Node[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                grid[i][j] = createNode("N_" + i + "_" + j, i * 50.0, j * 50.0);
            }
        }
        nodeRepository.saveAll(flatten(grid));

        // Edges: Horizontal & Vertical (Bi-directional)
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                // Horizontal (to Right)
                if (i < 2) {
                    createAndSaveBiEdge(grid[i][j], grid[i + 1][j], 50.0);
                }
                // Vertical (to Bottom)
                if (j < 2) {
                    createAndSaveBiEdge(grid[i][j], grid[i][j + 1], 50.0);
                }
            }
        }

        // Special Nodes: GATE & RUNWAY
        Node gate = createNode("GATE_101", -50.0, 0.0);
        Node runway = createNode("RUNWAY", 150.0, 100.0);
        nodeRepository.save(gate);
        nodeRepository.save(runway);

        // Connect Special Nodes to Grid
        createAndSaveBiEdge(gate, grid[0][0], 50.0); // Gate -> (0,0)
        createAndSaveBiEdge(grid[2][2], runway, 80.0); // (2,2) -> Runway

        // 4. Vehicles
        TowingCar tc1 = createAndSaveCar("TC01", 0.0, 0.0, 100);
        TowingCar tc2 = createAndSaveCar("TC02", 50.0, 50.0, 90);

        // 5. Flights
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
                .nodeCode("GATE_101")
                .departureDate(LocalDate.now())
                .scheduledTime(LocalDateTime.now().plusHours(2))
                .build();
        flightRepository.save(flight);
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