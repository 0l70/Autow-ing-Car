package com.project.infra.websocket.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.project.domain.webrtc.dto.SignalingMessage;
import com.project.domain.towingcar.repository.TowingCarRepository;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.user.repository.UserRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class StompWebSocketService implements WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    private final TowingCarRepository towingCarRepository;
    private final FlightRepository flightRepository;
    private final UserRepository userRepository;

    // --- Generic Core Implementations ---

    @Override
    public void broadcast(String destination, Object payload) {
        messagingTemplate.convertAndSend(destination, payload);
    }

    @Override
    public void sendToUser(String username, String destination, Object payload) {
        messagingTemplate.convertAndSendToUser(username, destination, payload);
    }

    @Override
    public void sendToUsers(List<String> usernames, String destination, Object payload) {
        for (String username : usernames) {
            sendToUser(username, destination, payload);
        }
    }

    // --- Domain Specific Implementations (Delegating to Core) ---

    @Override
    public void notifyAdminRequest(Object payload) {
        broadcast("/topic/controller/requests", payload);
        log.info("관제사 알림 전송: {}", payload);
    }

    @Override
    public void notifyPilotResult(String pilotUsername, Object payload) {
        sendToUser(pilotUsername, "/queue/reply", payload);
    }

    @Override
    public void broadcastMissionUpdate(Object payload) {
        broadcast("/topic/mission/updates", payload);
    }

    @Override
    public void sendErrorToUser(String username, String message) {
        sendToUser(username, "/queue/errors", message);
    }

    @Override
    public void broadcastCarStatus(String carCode, Object monitoringPayload) {
        broadcast("/topic/towingcar/" + carCode, monitoringPayload);
    }

    @Override
    public void notifyFlightChannel(Long scheduleId, Object payload) {
        broadcast("/topic/flight/" + scheduleId, payload);
    }

    @Override
    public void broadcastMapInfo(Object payload) {
        broadcast("/topic/sys/map/info", payload);
    }

    // --- WebRTC Signaling ---

    @Override
    public void broadcastOffer(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            broadcast("/topic/video/offer/" + msg.getReceiverId(), msg);
            log.debug("WebRTC OFFER relayed to {}", msg.getReceiverId());
        }
    }

    @Override
    public void broadcastAnswer(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            broadcast("/topic/video/answer/" + msg.getReceiverId(), msg);
            log.debug("WebRTC ANSWER relayed to {}", msg.getReceiverId());
        }
    }

    @Override
    public void broadcastIce(Object payload) {
        if (payload instanceof SignalingMessage) {
            SignalingMessage msg = (SignalingMessage) payload;
            broadcast("/topic/video/ice/" + msg.getReceiverId(), msg);
            log.debug("WebRTC ICE relayed to {}", msg.getReceiverId());
        }
    }

    @Override
    public void sendMonitoringToScope(String carCode, Object payload) {
        // 1. Find TowingCar & Flight
        towingCarRepository.findByCode(carCode).ifPresent(car -> {
            flightRepository.findByTowingCar(car).ifPresent(flight -> {
                // 2. Send to Pilot (Private Queue)
                String pilotUsername = flight.getPilot().getUsername();
                sendToUser(pilotUsername, "/queue/car/monitoring", payload);
            });
        });

        // 3. Send to All ATCs (Loop)
        userRepository.findAllByRole(com.project.domain.common.UserRole.ATC).forEach(atc -> {
            sendToUser(atc.getUsername(), "/queue/car/monitoring", payload);
        });
    }
}