package com.project.domain.robot.service;

import com.project.infra.mqtt.util.RobotIncomingMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RobotNotificationService {

    private final SimpMessagingTemplate wsTemplate;

    public void broadcast(RobotIncomingMessage message) {
        // 경로를 동적으로 생성
        // /topic/robot/{carId}/{messageType}
        String destination = String.format("/topic/robot/%s/%s", 
                                           message.getCarId(), 
                                           message.getMessageType());

        // 전송 (JsonNode를 그대로 쏘므로 프론트에서 바로 JSON 사용 가능)
        wsTemplate.convertAndSend(destination, message.getPayload());

        // log.debug("WS 전송 [{}]: {}", destination, message.getMessageType());
    }
}