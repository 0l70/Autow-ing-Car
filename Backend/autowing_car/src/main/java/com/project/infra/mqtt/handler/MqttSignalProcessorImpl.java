package com.project.infra.mqtt.handler;

import org.springframework.stereotype.Component;

import com.project.domain.towingcar.service.TowingCarService;
import com.project.infra.mqtt.config.MqttIncomingMessage;
import com.project.infra.mqtt.handler.parser.MqttIncomingMessageParser;
import com.project.infra.websocket.service.WebSocketService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttSignalProcessorImpl implements MqttSignalProcessor {

    private final MqttIncomingMessageParser parser; // 메시지 해석기
    private final TowingCarService towingCarService; // DB 저장용
    private final WebSocketService webSocketService; // 실시간 전송용

    @Override
    public void process(String topic, String payload) {
        try {
            // 1. 파싱 (Topic -> carId, type / Payload -> JsonNode)
            MqttIncomingMessage baseMsg = parser.parse(topic, payload);

            if (baseMsg instanceof MqttIncomingMessage.CarData carData) {
                String carCode = carData.getCarCode();
                String type = carData.getMessageType();

                log.debug("Processing Signal: Car={}, Type={}", carCode, type);

                if ("monitoring".equals(type)) {
                    // A. DB 저장
                    towingCarService.processCarMonitoring(carCode, carData.getPayload());

                    // B. 웹소켓 전송 (Targeted: Pilot + ATCs)
                    webSocketService.broadcastCarStatus(carCode, payload);
                }
            } else if (baseMsg instanceof MqttIncomingMessage.MapData mapData) {
                log.info("Map Info Received: Broadcasting...");
                webSocketService.broadcastMapInfo(mapData.getPayload());
            } else if (baseMsg instanceof MqttIncomingMessage.Ack ack) {
                log.info("ACK Received: Broadcasting...", ack.getPayload());
            }

        } catch (Exception e) {
            log.error("신호 처리 중 오류 발생: Topic={}, Error={}", topic, e.getMessage());
        }
    }
}
