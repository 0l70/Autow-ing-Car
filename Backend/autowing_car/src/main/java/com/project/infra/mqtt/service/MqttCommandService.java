package com.project.infra.mqtt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.infra.mqtt.config.MqttTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MqttCommandService {

    private final MqttOutboundService mqttOutboundService;
    private final ObjectMapper objectMapper;

    /**
     * 트랜잭션 커밋 후 MQTT 명령 전송 (안전한 전송)
     */
    public void sendCommandAfterCommit(String carCode, String cmd, Map<String, Object> data) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendCommandImmediate(carCode, cmd, data);
                }
            });
        } else {
            sendCommandImmediate(carCode, cmd, data);
        }
    }

    /**
     * 즉시 MQTT 명령 전송
     */
    public void sendCommandImmediate(String carCode, String cmd, Map<String, Object> data) {
        try {
            String topic = String.format(MqttTopics.CMD_FORMAT, carCode);
            String payload = objectMapper.writeValueAsString(Map.of("cmd", cmd, "data", data));
            mqttOutboundService.publish(topic, payload);
            log.debug("📦 [Command] Car={} Cmd={}", carCode, cmd);
        } catch (Exception e) {
            log.error("❌ [Command] Failed to send to {}: {}", carCode, e.getMessage());
        }
    }
}
