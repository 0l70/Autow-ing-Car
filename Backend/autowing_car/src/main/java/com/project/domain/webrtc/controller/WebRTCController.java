package com.project.domain.webrtc.controller;

import com.project.domain.webrtc.dto.SignalingMessage;
import com.project.domain.webrtc.service.WebRTCWebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WebRTCController {

    private final WebRTCWebSocketService webRTCWebSocketService;

    // 1. Offer 수신 (from Jetson) -> Viewer에게 전달
    @MessageMapping("/video/offer")
    public void processOffer(SignalingMessage message) {
        log.debug("Received OFFER from {}", message.getSenderId());
        webRTCWebSocketService.broadcastOffer(message);
    }

    // 2. Answer 수신 (from Viewer) -> Jetson에게 전달
    @MessageMapping("/video/answer")
    public void processAnswer(SignalingMessage message) {
        log.debug("Received ANSWER from {}", message.getSenderId());
        webRTCWebSocketService.broadcastAnswer(message);
    }

    // 3. ICE Candidate 수신 (from Both) -> 상대방에게 전달
    @MessageMapping("/video/ice")
    public void processIce(SignalingMessage message) {
        log.debug("Received ICE from {}", message.getSenderId());
        webRTCWebSocketService.broadcastIce(message);
    }
}
