package com.project.domain.webrtc.controller;

import com.project.domain.webrtc.dto.SignalingMessage;
import com.project.domain.webrtc.service.WebRTCWebSocketService;

import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

/**
 * WebRTC 시그널링 WebSocket Controller
 * 
 * Jetson (차량) 서 Viewer (웹/앱) 간 WebRTC 연결을 위한 시그널링 처리
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class WebRTCController {

    private final WebRTCWebSocketService webRTCWebSocketService;

    @MessageMapping("/video/offer")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/video/offer", description = "Jetson(차량)에서 보내는 WebRTC Offer를 Viewer에게 중계합니다."))
    public void processOffer(SignalingMessage message) {
        log.debug("Received OFFER from {}", message.getSenderId());
        webRTCWebSocketService.broadcastOffer(message);
    }

    @MessageMapping("/video/answer")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/video/answer", description = "Viewer에서 보내는 WebRTC Answer를 Jetson에게 중계합니다."))
    public void processAnswer(SignalingMessage message) {
        log.debug("Received ANSWER from {}", message.getSenderId());
        webRTCWebSocketService.broadcastAnswer(message);
    }

    @MessageMapping("/video/ice")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/video/ice", description = "양측에서 보내는 ICE Candidate를 상대방에게 중계합니다."))
    public void processIce(SignalingMessage message) {
        log.debug("Received ICE from {}", message.getSenderId());
        webRTCWebSocketService.broadcastIce(message);
    }

    @MessageMapping("/video/control")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/video/control", description = "영상 스트리밍 제어 명령(START/STOP)을 Jetson에게 전송합니다."))
    public void processControl(SignalingMessage message) {
        log.debug("Received CONTROL ({}) from {}", message.getType(), message.getSenderId());
        webRTCWebSocketService.broadcastControl(message);
    }
}
