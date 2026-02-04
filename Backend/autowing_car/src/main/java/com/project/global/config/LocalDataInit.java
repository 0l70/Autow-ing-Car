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
import com.project.domain.map.entity.MapInfo;
import com.project.domain.map.repository.MapInfoRepository;
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;
import com.project.global.util.RdpSimplifier;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
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
    private final MapInfoRepository mapInfoRepository;
    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    private final UserRepository userRepository;
    private final AircraftRepository aircraftRepository;
    private final ObjectMapper objectMapper;
    private final ResourcePatternResolver resourceResolver = new PathMatchingResourcePatternResolver();

    private final List<String> finalLocations;

    public LocalDataInit(
            PasswordEncoder passwordEncoder, NodeRepository nodeRepository, EdgeRepository edgeRepository,
            MapInfoRepository mapInfoRepository, TowingCarRepository towingCarRepository,
            FlightRepository flightRepository, UserRepository userRepository,
            AircraftRepository aircraftRepository, ObjectMapper objectMapper,
            @Value("${app.map.locations}") List<String> mapLocations,
            @Value("${app.map.external-locations:}") String externalLocations) {
        this.passwordEncoder = passwordEncoder;
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.mapInfoRepository = mapInfoRepository;
        this.towingCarRepository = towingCarRepository;
        this.flightRepository = flightRepository;
        this.userRepository = userRepository;
        this.aircraftRepository = aircraftRepository;
        this.objectMapper = objectMapper;

        // Combine for priority: External Environment Var > Configured YAML List
        this.finalLocations = new ArrayList<>();
        if (externalLocations != null && !externalLocations.isBlank()) {
            for (String loc : externalLocations.split(",")) {
                finalLocations.add(loc.trim());
            }
        }
        finalLocations.addAll(mapLocations);
    }

    @Override
    public void run(String... args) {
        log.info("############ Local Data Initialization Start ############");

        // 0. 맵 메타데이터 초기화
        Resource activeYaml = initMapInfo();

        // 1. 사용자 초기화 (P001: 기장, A001: 관제사)
        User pilot = initUser("P001", "Maverick", "pilot@atc.com", "1234", UserRole.PILOT);
        initUser("A001", "TowerControl", "atc@atc.com", "1234", UserRole.ATC);

        // 2. 항공기 초기화 (B737, A320)
        Aircraft b737 = initAircraft("HL7777", "B737", 35.0, 39.0);
        Aircraft a320 = initAircraft("HL8888", "A320", 34.0, 37.0);

        // 3. 지도 데이터 초기화 (내장/외장 리소스 기반)
        Node s01 = createNode("S01", -1.22, -0.13);
        Node g01 = createNode("G01", 0.33, -0.28);
        Node r02 = createNode("R02", 4.03, -0.08);

        nodeRepository.saveAll(List.of(s01, g01, r02));

        // 4. 경로 데이터 초기화 (검색된 YAML 리소스 기준 상대 경로로 읽음)
        if (activeYaml != null) {
            importResourcePath("edge01", activeYaml, "edge01/path_S01_to_G01", s01, g01, 1.56);
            importResourcePath("edge02", activeYaml, "edge02/path_G01_to_R02", g01, r02, 3.70);
        } else {
            log.warn("[LocalDataInit] Active map resource is null, skipping edge path imports.");
        }

        // 5. 차량(Towing Car) 초기화
        TowingCar tc1 = createAndSaveCar("TC01", -1.22, -0.13, 100);
        TowingCar tc2 = createAndSaveCar("TC02", 0.33, -0.28, 90);

        // 6. 비행 정보 및 스케줄 초기화
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

    private TowingCar createAndSaveCar(String code, double x, double y, int battery) {
        TowingCar car = TowingCar.builder()
                .code(code).carStatus(CarStatus.IDLE).battery(battery)
                .lastPosX(x).lastPosY(y).lastHeading(0.0).build();
        return towingCarRepository.save(car);
    }

    private void createAndSaveFlight(String flightNumber, User pilot, TowingCar car, Aircraft aircraft) {
        Flight flight = Flight.builder()
                .flightNumber(flightNumber)
                .towingCar(car)
                .assignedTowingCar(car)
                .pilot(pilot)
                .aircraft(aircraft)
                .nodeCode("G01")
                .departureDate(LocalDate.now())
                .scheduledTime(LocalDateTime.now().plusHours(2))
                .build();
        flightRepository.save(flight);
    }

    private Resource initMapInfo() {
        if (mapInfoRepository.count() > 0) {
            log.info("[LocalDataInit] MapInfo already exists in DB, skipping resource scan.");
            return null;
        }

        for (String location : finalLocations) {
            try {
                Resource resource = resourceResolver.getResource(location);
                if (resource.exists()) {
                    log.info("[LocalDataInit] Attempting to load map metadata from: {}", resource.getDescription());
                    if (processMapYaml(resource)) {
                        return resource; // First successful load wins
                    }
                } else {
                    log.debug("[LocalDataInit] Map location not found: {}", location);
                }
            } catch (Exception e) {
                log.warn("[LocalDataInit] Error checking map location {}: {}", location, e.getMessage());
            }
        }

        log.error("[LocalDataInit] Failed to find valid map metadata in all configured locations!");
        return null;
    }

    private boolean processMapYaml(Resource yamlResource) {
        try (InputStream is = yamlResource.getInputStream()) {
            Map<String, String> yamlData = parseYamlStream(is);
            String imageName = yamlData.get("image");
            double resolution = Double.parseDouble(yamlData.get("resolution"));

            String originStr = yamlData.get("origin").replace("[", "").replace("]", "");
            String[] originParts = originStr.split(",");
            double originX = Double.parseDouble(originParts[0].trim());
            double originY = Double.parseDouble(originParts[1].trim());

            // Load PGM header to get map dimensions
            Resource pgmResource = yamlResource.createRelative(imageName);
            int[] dims = { 2000, 1500 }; // Default fallback
            if (pgmResource.exists()) {
                dims = parsePgmHeaderFromResource(pgmResource);
                log.info("[LocalDataInit] Map dimensions from PGM: {}x{}", dims[0], dims[1]);
            } else {
                log.warn("[LocalDataInit] PGM image file not found relative to YAML: {}", imageName);
            }

            mapInfoRepository.save(MapInfo.builder()
                    .mapCode("TEST_MAP_01")
                    .width(dims[0]).height(dims[1])
                    .resolution(resolution).originX(originX).originY(originY)
                    .maxSpeed(10.0).imagePath(imageName).basicMap(true).build());

            log.info("[LocalDataInit] Map metadata successfully loaded from {}", yamlResource.getDescription());
            return true;
        } catch (Exception e) {
            log.error("[LocalDataInit] Failed to process map YAML {}: {}", yamlResource.getDescription(),
                    e.getMessage());
            return false;
        }
    }

    private Map<String, String> parseYamlStream(InputStream is) throws IOException {
        Map<String, String> result = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty() || line.startsWith("#"))
                    continue;
                int decoIdx = line.indexOf(':');
                if (decoIdx > 0) {
                    String key = line.substring(0, decoIdx).trim();
                    String value = line.substring(decoIdx + 1).trim();
                    result.put(key, value);
                }
            }
        }
        return result;
    }

    private int[] parsePgmHeaderFromResource(Resource resource) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream()))) {
            String line = reader.readLine();
            if (line == null)
                throw new IOException("Empty PGM file");
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.startsWith("#") || line.isEmpty())
                    continue;
                String[] parts = line.split("\\s+");
                if (parts.length >= 2) {
                    return new int[] { Integer.parseInt(parts[0]), Integer.parseInt(parts[1]) };
                }
            }
        }
        throw new IOException("Could not find dimensions in PGM header");
    }

    private void importResourcePath(String prefix, Resource rootResource, String relativePath, Node start, Node end,
            double dist) {
        try {
            Resource pathResource = rootResource.createRelative(relativePath + ".json");
            if (!pathResource.exists()) {
                log.warn("[LocalDataInit] Path resource not found: {} (derived from {})",
                        pathResource.getDescription(), rootResource.getDescription());
                return;
            }

            try (InputStream is = pathResource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                JsonNode xArray = root.get("x");
                JsonNode yArray = root.get("y");

                List<RdpSimplifier.Point> rawPoints = new ArrayList<>();
                for (int i = 0; i < xArray.size(); i++) {
                    rawPoints.add(new RdpSimplifier.Point(xArray.get(i).asDouble(), yArray.get(i).asDouble()));
                }

                List<RdpSimplifier.Point> simplified = RdpSimplifier.simplify(rawPoints, 0.1);
                String waypointsJson = objectMapper.writeValueAsString(simplified);

                saveEdgeWithWaypoints("E_" + start.getNodeCode() + "_to_" + end.getNodeCode(), start, end, dist,
                        waypointsJson);

                // Reverse direction
                List<RdpSimplifier.Point> reversed = new ArrayList<>(simplified);
                java.util.Collections.reverse(reversed);
                saveEdgeWithWaypoints("E_" + end.getNodeCode() + "_to_" + start.getNodeCode(), end, start, dist,
                        objectMapper.writeValueAsString(reversed));

                log.info("[LocalDataInit] Imported path coordinates for {} from {}", prefix,
                        pathResource.getDescription());
            }
        } catch (Exception e) {
            log.error("[LocalDataInit] Failed to import path coordinates for {}: {}", prefix, e.getMessage());
        }
    }

    private void saveEdgeWithWaypoints(String code, Node src, Node dst, double distance, String waypoints) {
        Double tTime = (distance > 0) ? (distance / 30.0) : 0.0;
        Edge edge = Edge.builder()
                .edgeCode(code).srcNode(src).dstNode(dst)
                .distance(distance).status(MapStatus.AVAILABLE).maxSpeed(30).restrictionInfo("NONE")
                .waypoints(waypoints)
                .travelTime(tTime)
                .build();
        edgeRepository.save(edge);
    }

    private void createAndSaveEdge(String code, Node src, Node dst, double distance) {
        Double tTime = (distance > 0) ? (distance / 30.0) : 0.0;
        Edge edge = Edge.builder()
                .edgeCode(code).srcNode(src).dstNode(dst)
                .distance(distance).status(MapStatus.AVAILABLE).maxSpeed(30).restrictionInfo("NONE")
                .travelTime(tTime)
                .build();
        edgeRepository.save(edge);
    }
}
