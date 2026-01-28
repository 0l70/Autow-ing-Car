package com.project.infra.mqtt.handler;

import org.springframework.stereotype.Component;

import com.project.domain.towingcar.service.TowingCarService;
import com.project.global.util.MqttIncomingMessage;
import com.project.global.util.RobotMessageParser;
import com.project.infra.websocket.service.WebSocketService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttSignalProcessorImpl implements MqttSignalProcessor {

    private final RobotMessageParser parser; // 메시지 해석기
    private final TowingCarService towingCarService; // DB 저장용
    private final WebSocketService webSocketService; // 실시간 전송용

    @Override
    public void processAndBroadcast(String topic, String payload) {
        try {
            // 1. 파싱 (Topic -> carId, type / Payload -> JsonNode)
            MqttIncomingMessage msg = parser.parse(topic, payload);

            String carCode = msg.getCarCode();
            String type = msg.getMessageType();

            log.debug("Processing Signal: Car={}, Type={}", carCode, type);

            // 2. 타입별 분기 처리
            if ("monitoring".equals(type)) {
                // A. DB 저장 (최신 상태 갱신 + 로그 적재)
                towingCarService.processCarMonitoring(carCode, msg.getPayload());

                // B. 웹소켓 전송 (관제 화면 갱신)
                webSocketService.broadcastCarStatus(carCode, msg.getPayload());
            } else if ("map".equals(type)) {
                // [NEW] 맵 정보 수신 시 브로드캐스트
                log.info("Map Info Received from {}: Broadcasting...", carCode);
                webSocketService.broadcastMapInfo(msg.getPayload());
            }

        } catch (Exception e) {
            log.error("신호 처리 중 오류 발생: Topic={}, Error={}", topic, e.getMessage());
        }
    }
}
