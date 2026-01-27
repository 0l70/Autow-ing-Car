package com.project.global.auth;

import com.project.global.auth.dto.AuthDtos;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    // Spring이 관리하는 STOMP 사용자 저장소
    private final SimpUserRegistry userRegistry;

    @PostMapping("/login")
    public ResponseEntity<AuthDtos.TokenResponse> login(@RequestBody AuthDtos.LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        // 1. SecurityContext 초기화 (현재 스레드의 인증 정보 제거)
        SecurityContextHolder.clearContext();

        // 2. 세션 무효화 (만약 존재한다면)
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/session/debug")
    public Map<String, Object> getConnectedSessions() {
        Map<String, Object> response = new HashMap<>();

        // 1. 전체 연결 수
        response.put("total_users", userRegistry.getUserCount());

        // 2. 사용자별 세션 상세 정보
        List<Map<String, Object>> userList = new ArrayList<>();

        for (SimpUser user : userRegistry.getUsers()) {
            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("username", user.getName()); // Principal Name (예: pilot@atc.com)
            userInfo.put("has_sessions", user.hasSessions());

            // 한 사용자가 여러 기기에서 접속할 수 있으므로 세션은 리스트임
            List<Map<String, String>> sessions = user.getSessions().stream()
                    .map(session -> {
                        Map<String, String> sessionInfo = new HashMap<>();
                        sessionInfo.put("session_id", session.getId());
                        sessionInfo.put("user_agent", session.toString()); // 필요 시 더 상세 파싱 가능
                        return sessionInfo;
                    })
                    .collect(Collectors.toList());

            userInfo.put("sessions", sessions);
            userList.add(userInfo);
        }

        response.put("users", userList);
        return response;
    }
}
