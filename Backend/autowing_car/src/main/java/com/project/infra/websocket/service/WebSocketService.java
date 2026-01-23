package com.project.infra.websocket.service;

public interface WebSocketService {
    // 1. 관제사에게 "이거 승인 좀 해주세요" (요청 + 분석데이터)
    void notifyAdminRequest(Object payload);

    // 2. 특정 기장에게 "결과 나왔습니다" (개별 알림)
    void notifyPilotResult(String pilotUsername, Object payload);

    // 3. 전체 화면 갱신 (현황판용)
    void broadcastMissionUpdate(Object payload);

    // 4. 에러 알림
    void sendErrorToUser(String username, String message);

    void broadcastCarStatus(String carCode, Object monitoringPayload);
}