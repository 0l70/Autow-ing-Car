package com.project.domain.map.service;

import com.project.infra.websocket.constant.WebSocketTopics;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MapWebSocketService {

    private final WebSocketService webSocketService;

    // 맵 정보
    public void broadcastMapInfo(Object payload) {
        webSocketService.broadcast(WebSocketTopics.TOPIC_MAP_INFO, payload);
    }
}
