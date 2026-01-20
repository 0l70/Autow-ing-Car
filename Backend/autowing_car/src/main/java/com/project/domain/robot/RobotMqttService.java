package com.project.domain.robot;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.domain.robot.RobotStatusDto;
import com.project.infra.mqtt.MqttConfig; // Gateway가 있는 곳
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RobotMqttService {

    private final ObjectMapper objectMapper; // JSON 파싱용
    private final MqttConfig.MqttGateway mqttGateway; // 메시지 발송용
    // private final SseService sseService; // (만들어둔 SSE 서비스가 있다면 주입)

    public void handleMessage(String topic, String payload) {
        log.info("Topic: {}, Payload: {}", topic, payload);

        if (topic.equals("autowing/robot/status")) {
            try {
                // 1. JSON 문자열 -> 객체 변환
                RobotStatusDto robotStatus = objectMapper.readValue(payload, RobotStatusDto.class);
                
                // 2. (선택) DB에 위치 로그 저장
                // robotLogRepository.save(robotStatus.toEntity());

                // 3. SSE를 통해 관제 화면(프론트)으로 실시간 전송
                // sseService.broadcast(robotStatus);
                log.info("로봇 위치 업데이트: ({}, {})", robotStatus.getLatitude(), robotStatus.getLongitude());

            } catch (Exception e) {
                log.error("JSON 파싱 에러: {}", e.getMessage());
            }
        } 
        else if (topic.equals("autowing/robot/error")) {
            log.error("로봇 에러 발생! : {}", payload);
            // 관리자에게 알림 보내기 로직 등
        }
    }

    /**
     * 로봇에게 명령 전송 (제어)
     */
    public void sendCommandToRobot(String command) {
        // 예: {"cmd": "STOP", "reason": "emergency"}
        String topic = "autowing/server/command";
        mqttGateway.sendToMqtt(command, topic);
        log.info("로봇에게 명령 전송: {}", command);
    }
}