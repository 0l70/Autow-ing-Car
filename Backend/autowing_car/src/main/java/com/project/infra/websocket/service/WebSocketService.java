package com.project.infra.websocket.service;

import java.util.List;

public interface WebSocketService {
    // --- Generic Core Methods (To be implemented) ---

    // 1. Broadcast to a specific topic
    void broadcast(String destination, Object payload);

    // 2. Unicast to a specific user (User-specific queue)
    void sendToUser(String username, String destination, Object payload);

    // 3. Multicast to multiple users (Convenience method)
    void sendToUsers(List<String> usernames, String destination, Object payload);

}