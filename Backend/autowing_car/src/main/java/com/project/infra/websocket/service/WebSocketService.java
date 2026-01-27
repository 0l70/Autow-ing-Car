package com.project.infra.websocket.service;

public interface WebSocketService {
    // 1. 관제사에게 "이거 승인 좀 해주세요" (요청 + 분석데이터) -> /topic/controller/requests
    void notifyAdminRequest(Object payload);

    // 2. 특정 기장에게 "결과 나왔습니다" (개별 알림)
    void notifyPilotResult(String pilotUsername, Object payload);

    // 3. 전체 화면 갱신 (현황판용)
    void broadcastMissionUpdate(Object payload);

    // 4. 에러 알림
    void sendErrorToUser(String username, String message);

    // 5. 특정 차량 상태/명령 전송 -> /topic/towingcar/{towingCarId}
    void broadcastCarStatus(String carCode, Object monitoringPayload);

    // 6. 특정 항공편 채널 전송 (기장 & 관제사 공유) -> /topic/flight/{scheduleId}
    void notifyFlightChannel(Long scheduleId, Object payload);

    // 7. 맵 정보 전체 브로드캐스트 (Added via Merge)
    void broadcastMapInfo(Object payload);
}