package com.project.global.config;

import com.project.domain.common.UserRole;
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // 1. PILOT User 생성 (중복 방지 체크)
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
    }
}
