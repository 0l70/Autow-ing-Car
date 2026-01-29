package com.project.infra.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

@Slf4j
@Component
public class WebSocketEventListener {

    // 1. 누군가 연결했을 때
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        log.info("🔌 [WS] 새로운 연결 감지!");
    }

    // 2. 누군가 구독(Subscribe) 했을 때 -> ★ 여기가 중요함
    @EventListener
    public void handleSessionSubscribeEvent(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = headerAccessor.getDestination();
        String sessionId = headerAccessor.getSessionId();

        // 클라이언트가 무슨 주소를 듣고 있는지 로그로 범인 색출
        log.info("👂 [WS] 구독 감지: Session={} / Destination={}", sessionId, destination);
    }
}