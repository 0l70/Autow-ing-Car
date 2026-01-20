package com.project.infra.mqtt;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.robot.RobotCommand;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MqttPublisher {

    private final MqttConfig.MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    public void sendCommand(Long robotId, RobotCommand command) {
        try {
            String payload = objectMapper.writeValueAsString(command);
            String topic = "robot/" + robotId + "/command";
            
            mqttGateway.sendToMqtt(topic, payload);
            log.info("🚀 [송신] 토픽: {}, 명령: {}", topic, command.getCommand());
        } catch (Exception e) {
            log.error("❌ 명령 전송 실패: {}", e.getMessage());
        }
    }
} 
