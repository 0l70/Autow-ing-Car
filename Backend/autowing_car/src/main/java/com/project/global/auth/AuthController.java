package com.project.global.auth;

import com.project.global.auth.dto.AuthDtos;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

import java.util.Enumeration;

import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<String> sessionDebug(HttpSession session) {
      Enumeration<String> names = session.getAttributeNames();

      while (names.hasMoreElements()) {
          String name = names.nextElement();
          Object value = session.getAttribute(name);
          System.out.println(name + " = " + value);
      }

      return ResponseEntity.ok(names.toString());
    }
}
