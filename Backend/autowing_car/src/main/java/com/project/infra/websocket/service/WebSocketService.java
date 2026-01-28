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

    // --- Domain Specific Methods (Refactor to use Generic Methods internally in
    // impl) ---

    // 1. 관제사에게 "이거 승인 좀 해주세요" (요청 + 분석데이터) -> /topic/controller/requests
    void notifyAdminRequest(Object payload);

    // 2. 기장에게 결과 전송
    void notifyPilotResult(String pilotUsername, Object payload);

    // 3. 전체 화면 갱신
    void broadcastMissionUpdate(Object payload);

    // 4. 에러 알림
    void sendErrorToUser(String username, String message);

    // 5. 차량 상태 전송
    void broadcastCarStatus(String carCode, Object monitoringPayload);

    // 6. 항공편 채널 전송
    void notifyFlightChannel(Long scheduleId, Object payload);

    // 7. 맵 정보
    void broadcastMapInfo(Object payload);

    // 8. WebRTC
    void broadcastOffer(Object payload);

    void broadcastAnswer(Object payload);

    void broadcastIce(Object payload);

    // 9. Targeted Monitoring
    void sendMonitoringToScope(String carCode, Object payload);
}