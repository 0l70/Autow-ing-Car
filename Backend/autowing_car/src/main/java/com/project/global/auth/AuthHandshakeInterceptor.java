package com.project.global.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
            String token = servletRequest.getServletRequest().getParameter("socket_token");

            if (token != null && jwtTokenProvider.validateToken(token)) {
                // 토큰이 유효하면 attributes에 사용자 정보 저장 (필요 시)
                // Authentication auth = jwtTokenProvider.getAuthentication(token);
                // attributes.put("USER_PRINCIPAL", auth);
                String userId = jwtTokenProvider.getUserId(token);
                attributes.put("USER_ID", userId);

                log.info("[WS Handshake] 연결 승인: {}", userId);
                return true;
            }
        }

        log.warn("WebSocket Handshake Failed: Invalid or Missing Token");

        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Exception exception) {
        // Handshake 후 처리 (로깅 등)
    }
}
