package com.project.infra.mqtt;

import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.robot.RobotTelemetry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MqttSubscriber {

    private final ObjectMapper objectMapper;
    // private final RobotRepository robotRepository; // 이후 로봇 상태 업데이트용

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleTelemetry(Message<?> message) {
        String payload = (String) message.getPayload();
        String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);

        try {
            RobotTelemetry data = objectMapper.readValue(payload, RobotTelemetry.class);
            log.info("📡 [수신] 토픽: {}, 로봇ID: {}, 위치: ({}, {}), 상태: {}", 
                     topic, data.getRobotId(), data.getLat(), data.getLng(), data.getStatus());
            
            // TODO: 로봇 엔티티의 위도/경도/상태 업데이트 로직 추가
            
        } catch (Exception e) {
            log.error("❌ 메시지 파싱 에러: {}", e.getMessage());
        }
    }
} 