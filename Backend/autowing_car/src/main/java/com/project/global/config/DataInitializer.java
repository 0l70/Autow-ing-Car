package com.project.global.config;

import com.project.domain.common.CarStatus;
import com.project.domain.common.UserRole;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.repository.TowingCarRepository;
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final FlightRepository flightRepository;
    private final TowingCarRepository towingCarRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        User pilot = null;

        // 1. PILOT User 생성 (중복 방지 체크)
        if (!userRepository.existsByEmployeeCode("P001")) {
            pilot = User.builder()
                    .email("pilot@atc.com")
                    .password(passwordEncoder.encode("1234")) // 비밀번호: 1234
                    .username("Maverick")
                    .employeeCode("P001")
                    .role(UserRole.PILOT)
                    .build();
            userRepository.save(pilot);
            System.out.println("✅ 초기 데이터 생성: PILOT (email: pilot@atc.com / pw: 1234)");
        } else {
            pilot = userRepository.findByEmployeeCode("P001").orElse(null);
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

        // 3. TowingCar 생성
        TowingCar car = null;
        if (!towingCarRepository.existsByCode("TC-01")) {
            car = TowingCar.builder()
                    .code("TC-01")
                    .carStatus(CarStatus.IDLE)
                    .battery(100)
                    .lastHeading(0.0)
                    .lastPosX(0.0)
                    .lastPosY(0.0)
                    .build();
            towingCarRepository.save(car);
            System.out.println("✅ 초기 데이터 생성: TowingCar (TC-01)");
        } else {
            car = towingCarRepository.findByCode("TC-01").orElse(null);
        }

        // 4. Flight 생성 (필수: 기장과 비행기가 매칭되어 있어야 함)
        if (!flightRepository.existsByFlightNumber("KE123")) {
            Flight flight = Flight.builder()
                    .flightNumber("KE123")
                    // .airline("Korean Air") // Entity에서 삭제됨
                    .nodeCode("GATE_105") // 출발 게이트
                    .departureDate(LocalDate.now())
                    .scheduledTime(LocalDateTime.now().plusHours(1))
                    .pilot(pilot) // 기장 할당
                    .towingCar(car) // 토잉카 할당 (이미 연결되었다고 가정 테스트용)
                    .build();
            flightRepository.save(flight);
            // 강제로 ID를 1로 맞출 순 없지만(Auto Increment), 첫 데이터면 보통 1번임.
            System.out.println("✅ 초기 데이터 생성: Flight (KE123, Assigned Pilot: Maverick)");
        }
    }
}
