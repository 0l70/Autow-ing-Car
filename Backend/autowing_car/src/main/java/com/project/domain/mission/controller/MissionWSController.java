package com.project.domain.mission.controller;

import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.service.MissionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class MissionWSController {

    private final MissionService missionService;

    /**
     * 1. [기장] 미션 생성 요청
     * - Endpoint: /app/mission/request
     * - 기장이 "나 출발할래(Gate->Runway)"라고 요청하면 서버가 분석 후 관제사에게 결재를 올림.
     */
    // @AsyncListener(
    // operation = @AsyncOperation(
    // channelName = "/app/mission/request",
    // description = "기장이 미션(출발)을 요청합니다."
    // )
    // )
    @MessageMapping("/mission/request")
    public void requestMission(@Payload PilotRequestDto requestDto, Principal principal) {
        // Principal 검증 (실무에서는 필수)
        validatePrincipal(principal);
        String pilotId = (principal != null) ? principal.getName() : "AnonymousPilot";

        log.info("[WS] Mission Request received from: {}", pilotId);
        missionService.createTransportMission(pilotId, requestDto);
    }

    /**
     * 2. [관제사] 미션 승인/반려 결정
     * - Endpoint: /app/mission/decide
     * - 관제사가 추천된 경로와 차량 중 하나를 선택하여 승인 버튼을 누름.
     */
    // @AsyncListener(
    // operation = @AsyncOperation(
    // channelName = "/app/mission/decide",
    // description = "관제사가 미션을 승인 또는 반려합니다."

    // )
    // )
    @MessageMapping("/mission/decide")
    public void decideMission(@Payload ATCDecisionDto decisionDto, Principal principal) {
        validatePrincipal(principal);
        String controllerId = (principal != null) ? principal.getName() : "ATC";

        log.info("[WS] Admin Decision from: {}, Approved: {}", controllerId, decisionDto.isApproved());
        missionService.approveMission(controllerId, decisionDto);
    }

    private void validatePrincipal(Principal principal) {
        if (principal == null) {
            throw new SecurityException("인증되지 않은 사용자입니다. (Headers에 login 정보를 포함하세요)");
        }
    }

    /**
     * 3. [기장] 미션 비상 제어 (일시정지/재개)
     * - Endpoint: /app/mission/control
     * - 주행 중인 로봇을 기장이 긴급하게 멈추거나 다시 출발시킴.
     */
    // @AsyncListener(
    // operation = @AsyncOperation(
    // channelName = "/app/mission/control",
    // description = "기장이 미션을 일시정지 또는 재개합니다."
    // )
    // )
    @MessageMapping("/mission/control")
    public void controlMission(@Payload PilotControlDto controlDto, Principal principal) {
        validatePrincipal(principal);
        String pilotId = (principal != null) ? principal.getName() : "AnonymousPilot";

        log.info("[WS] Mission Control from: {}, Command: {}", pilotId, controlDto.getCommand());
        missionService.controlMission(pilotId, controlDto);
    }
}