package com.project.domain.mission.service;

import com.project.infra.websocket.constant.WebSocketTopics;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionWebSocketService {

    private final WebSocketService webSocketService;

    // 1. 관제사에게 "이거 승인 좀 해주세요" (요청 + 분석데이터) -> /topic/controller/requests
    public void notifyAdminRequest(Object payload) {
        webSocketService.broadcast(WebSocketTopics.TOPIC_CONTROLLER_REQUESTS, payload);
        log.info("관제사 알림 전송: {}", payload);
    }

    // 2. 기장에게 결과 전송
    public void notifyPilotResult(String pilotUsername, Object payload) {
        webSocketService.sendToUser(pilotUsername, WebSocketTopics.QUEUE_REPLY, payload);
        log.info("기장 알림 전송: {}", payload);
    }

    // 3. 전체 화면 갱신
    public void broadcastMissionUpdate(Object payload) {
        webSocketService.broadcast(WebSocketTopics.TOPIC_MISSION_UPDATES, payload);
        log.info("전체 화면 갱신: {}", payload);
    }

    // 4. 에러 알림
    public void sendErrorToUser(String username, String message) {
        webSocketService.sendToUser(username, WebSocketTopics.QUEUE_ERRORS, message);
        log.info("에러 알림 전송: {}", message);
    }
}
