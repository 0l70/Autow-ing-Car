package com.project.infra.mqtt.handler;

import org.springframework.stereotype.Component;

import com.project.domain.towingcar.service.TowingCarService;
import com.project.global.util.RobotIncomingMessage;
import com.project.global.util.RobotMessageParser;
import com.project.infra.websocket.service.WebSocketService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class TowingCarSignalProcessorImpl implements TowingCarSignalProcessor {

    private final RobotMessageParser parser; // 메시지 해석기
    private final TowingCarService towingCarService; // DB 저장용
    private final WebSocketService webSocketService; // 실시간 전송용

    @Override
    public void processAndBroadcast(String topic, String payload) {
        try {
            // 1. 파싱 (Topic -> carId, type / Payload -> JsonNode)
            RobotIncomingMessage msg = parser.parse(topic, payload);

            String carId = msg.getCarId();
            String type = msg.getMessageType();

            log.debug("Processing Signal: Car={}, Type={}", carId, type);

            // 2. 타입별 분기 처리
            if ("monitoring".equals(type)) {
                // A. DB 저장 (최신 상태 갱신 + 로그 적재)
                towingCarService.processCarMonitoring(carId, msg.getPayload());

                // B. 웹소켓 전송 (관제 화면 갱신)
                // 예: /topic/robot/TC01/monitoring
                webSocketService.broadcastCarStatus(carId, msg.getPayload());
            }
            // else if ("event".equals(type)) {
            // // 예: 장애물 감지, 배터리 부족 등 이벤트 처리
            // log.info("Event received from {}: {}", carId, msg.getPayload());
            // webSocketService.notifyError("EVENT from " + carId + ": " +
            // msg.getPayload().toString());
            // }

        } catch (Exception e) {
            log.error("신호 처리 중 오류 발생: Topic={}, Error={}", topic, e.getMessage());
        }
    }
}
