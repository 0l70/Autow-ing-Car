package com.project.domain.webrtc.service;

import com.project.domain.webrtc.dto.SignalingMessage;
import com.project.infra.websocket.constant.WebSocketTopics;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebRTCWebSocketService {

    private final WebSocketService webSocketService;

    public void broadcastOffer(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            webSocketService.broadcast(WebSocketTopics.videoOffer(msg.getReceiverId()), msg);
            log.debug("WebRTC OFFER relayed to {}", msg.getReceiverId());
        }
    }

    public void broadcastAnswer(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            webSocketService.broadcast(WebSocketTopics.videoAnswer(msg.getReceiverId()), msg);
            log.debug("WebRTC ANSWER relayed to {}", msg.getReceiverId());
        }
    }

    public void broadcastIce(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            webSocketService.broadcast(WebSocketTopics.videoIce(msg.getReceiverId()), msg);
            log.debug("WebRTC ICE relayed to {}", msg.getReceiverId());
        }
    }
}
