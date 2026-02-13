package com.project.infra.websocket.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class StompWebSocketService implements WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    // --- Generic Core Implementations ---

    @Override
    public void broadcast(String destination, Object payload) {
        messagingTemplate.convertAndSend(destination, payload);
    }

    @Override
    public void sendToUser(String username, String destination, Object payload) {
        log.info("🔔 [WebSocket] Sending to User: username={}, destination={}, payload={}",
                username, destination, payload);
        messagingTemplate.convertAndSendToUser(username, destination, payload);
        log.info("✅ [WebSocket] Message sent to /user/{}/{}", username, destination);
    }

    @Override
    public void sendToUsers(List<String> usernames, String destination, Object payload) {
        for (String username : usernames) {
            sendToUser(username, destination, payload);
        }
    }
}
