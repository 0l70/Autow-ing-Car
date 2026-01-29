package com.project.domain.towingcar.service;

import com.project.infra.websocket.constant.WebSocketTopics;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CarWebSocketService {

    private final WebSocketService webSocketService;

    // 1. 차량 상태 브로드캐스트 (Topic: /topic/car/{carCode})
    public void broadcastCarStatus(String carCode, Object monitoringPayload) {
        webSocketService.broadcast(WebSocketTopics.carStatus(carCode), monitoringPayload);
    }

    // 2. 항공편 채널 알림 (Topic: /topic/flight/{scheduleId})
    public void notifyFlightChannel(Long scheduleId, Object payload) {
        webSocketService.broadcast(WebSocketTopics.flightChannel(scheduleId), payload);
    }

    // 3. 기장에게 비행 정보 전송 (Queue: /user/{id}/queue/flight-info)
    public void notifyPilotFlightInfo(String pilotId, Object flightInfo) {
        log.info("[WS] Sending Flight Info to Pilot: {}", pilotId);
        webSocketService.sendToUser(pilotId, WebSocketTopics.QUEUE_FLIGHT_INFO, flightInfo);
    }
}
