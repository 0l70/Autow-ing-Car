package com.project.domain.robot.controller;

import com.project.domain.robot.dto.RobotCommandDTO;
import com.project.domain.robot.service.RobotService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class RobotCommandSocketController {

    private final RobotService robotService;
    private final SimpMessagingTemplate wsTemplate;

    // ==========================================
    // 1. [기장] 출발/정지 요청 (Client Send: /app/control/request)
    // ==========================================
    @MessageMapping("/control/request")
    public void handleRequest(@Payload CommandRequestMessage msg) {
        try {
            log.info("📩 WS 요청 수신: {}", msg);
            
            // 서비스 로직 호출 (DB 저장 + 관제사 알림 전송됨)
            String cmdId = robotService.requestCommand(msg.getCarId(), msg.getType());

            // (옵션) 기장에게 "요청 잘 접수됨" 피드백 보내기
            // 기장이 구독 중인 경로 예: /topic/pilot/feedback
            wsTemplate.convertAndSend("/topic/pilot/feedback", "요청 접수 완료 (ID: " + cmdId + ")");

        } catch (Exception e) {
            sendError("/topic/pilot/errors", "요청 실패: " + e.getMessage());
        }
    }

    // ==========================================
    // 2. [관제사] 승인 (Client Send: /app/control/approve)
    // ==========================================
    @MessageMapping("/control/approve")
    public void handleApprove(@Payload DecisionMessage msg) {
        try {
            log.info("✅ WS 승인 수신: CmdID={}", msg.getCmdId());
            
            // 서비스 호출 (MQTT 발송됨)
            robotService.approveCommand(msg.getCmdId());
            
            // 관제사에게 성공 알림
            wsTemplate.convertAndSend("/topic/admin/alerts", "명령이 승인되어 전송되었습니다.");

        } catch (Exception e) {
            sendError("/topic/admin/errors", "승인 처리 실패: " + e.getMessage());
        }
    }

    // ==========================================
    // 3. [관제사] 반려 (Client Send: /app/control/reject)
    // ==========================================
    @MessageMapping("/control/reject")
    public void handleReject(@Payload DecisionMessage msg) {
        try {
            robotService.rejectCommand(msg.getCmdId());
            wsTemplate.convertAndSend("/topic/admin/alerts", "명령이 반려되었습니다.");
        } catch (Exception e) {
            sendError("/topic/admin/errors", "반려 처리 실패: " + e.getMessage());
        }
    }

    // --- 에러 처리 편의 메서드 ---
    private void sendError(String topic, String errorMessage) {
        log.error("WS Error Sent: {}", errorMessage);
        wsTemplate.convertAndSend(topic, errorMessage);
    }
    
    // --- WebSocket 내에서 발생하는 예외 전역 처리 ---
    @MessageExceptionHandler
    public void handleException(Exception e) {
        log.error("WebSocket Exception: ", e);
    }
}

// ==========================================
// 4. WebSocket 전용 수신 DTO (Inner Class or 별도 파일)
// ==========================================

@Data
class CommandRequestMessage {
    private String carId;
    private RobotCommandDTO.CommandType type;
    private String targetNode;
}

@Data
class DecisionMessage {
    private String cmdId;
}