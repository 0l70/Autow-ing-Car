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

    // 차량 상태 전송
    public void broadcastCarStatus(String carCode, Object monitoringPayload) {
        webSocketService.broadcast(WebSocketTopics.carChannel(carCode), monitoringPayload);
    }

    // 항공편 채널 전송
    public void notifyFlightChannel(Long scheduleId, Object payload) {
        webSocketService.broadcast(WebSocketTopics.flightChannel(scheduleId), payload);
    }
}
