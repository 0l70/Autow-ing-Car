package com.project.infra.websocket.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.project.domain.flight.service.FlightDBAdaptor;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import com.project.domain.user.service.UserDBAdaptor;

@Slf4j
@Service
@RequiredArgsConstructor
public class StompWebSocketService implements WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void notifyAdminRequest(Object payload) {
        // 관제사는 '/topic/controller/requests'를 보고 있다고 가정
        String destination = "/topic/controller/requests";
        messagingTemplate.convertAndSend(destination, payload);
        log.info("관제사 알림 전송: {}", payload);
    }

    @Override
    public void notifyPilotResult(String pilotUsername, Object payload) {
        // 기장은 '/user/queue/reply'를 구독 중 (개별 메시지)
        messagingTemplate.convertAndSendToUser(
                pilotUsername,
                "/queue/reply",
                payload);
    }

    @Override
    public void broadcastMissionUpdate(Object payload) {
        messagingTemplate.convertAndSend("/topic/mission/updates", payload);
    }

    @Override
    public void sendErrorToUser(String username, String message) {
        messagingTemplate.convertAndSendToUser(username, "/queue/errors", message);
    }

    // 특정 차의 상태를 실시간으로 브로드캐스트하는 메서드
    @Override
    public void broadcastCarStatus(String carCode, Object monitoringPayload) {
        // 요청 사항: /topic/towingcar/{towingCarId}
        messagingTemplate.convertAndSend("/topic/towingcar/" + carCode, monitoringPayload);
    }

    @Override
    public void notifyFlightChannel(Long scheduleId, Object payload) {
        // 요청 사항: /topic/flight/{scheduleId}
        messagingTemplate.convertAndSend("/topic/flight/" + scheduleId, payload);
    }

    @Override
    public void broadcastMapInfo(Object payload) {
        messagingTemplate.convertAndSend("/topic/sys/map/info", payload); // 프론트와 토픽 일치시킴
    }
}