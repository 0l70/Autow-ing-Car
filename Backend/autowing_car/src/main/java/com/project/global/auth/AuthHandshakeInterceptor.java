package com.project.global.auth;

import jakarta.servlet.http.HttpServletRequest;
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
        
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            String path = httpRequest.getRequestURI();
            
            // SockJS의 /info 요청 등은 통과시키거나, 여기서도 토큰 검사를 할지 결정해야 함.
            // 보통 /info 요청은 인증을 생략하고 실제 websocket upgrade 요청만 막아도 됨.
            if (path.endsWith("/info")) {
                log.debug("[WS Interceptor] SockJS Info 요청 통과");
                return true; 
            }

            String token = httpRequest.getParameter("socket_token");
            log.info("[WS Interceptor] 핸드쉐이크 시도. Path: {}, Token 존재여부: {}", path, (token != null));

            if (token != null && jwtTokenProvider.validateToken(token)) {

                if (!jwtTokenProvider.isSocketToken(token)) {
                    log.warn("[WS Interceptor] 연결 거부: Access Token으로는 연결할 수 없습니다.");
                    return false;
                }
                String userId = jwtTokenProvider.getUserId(token);
                attributes.put("USER_ID", userId);
                log.info("[WS Interceptor] 인증 성공. UserID: {}", userId);
                return true;
            }
        
        }
        
        log.warn("[WS Interceptor] 인증 실패. 연결 거부.");
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Exception exception) {
    }
}