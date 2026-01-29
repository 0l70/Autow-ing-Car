package com.project.domain.mission.controller;

import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.service.MissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import java.security.Principal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class MissionWSController {

    private final MissionService missionService;

    // [기장] 운송 요청 (Scenario B-1)
    @MessageMapping("/mission/request")
    // @PreAuthorize("@missionGuard.checkRequestOwnership(authentication,
    // #requestDto.flightId)") // TODO: WebSocket SecurityContext 이슈로 임시 주석
    public void requestMission(@Payload PilotRequestDto requestDto, Principal principal) {
        log.info("[WS] Mission Request: Pilot={}, FlightId={}", principal.getName(), requestDto.getFlightId());
        missionService.requestTransport(principal.getName(), requestDto);
    }

    // 2. [관제사] 미션 승인/반려 (보안 검증 적용)
    @MessageMapping("/mission/decide")
    // @PreAuthorize("@missionGuard.checkApprovePermission(authentication)") //
    // TODO: WebSocket SecurityContext 이슈로 임시 주석
    public void decideMission(@Payload ATCDecisionDto decisionDto, Principal principal) {
        log.info("[WS] ATC Decision: Admin={}, Approved={}", principal.getName(), decisionDto.isApproved());
        missionService.approveMission(principal.getName(), decisionDto);
    }

    // [기장/관제] 미션 제어 (정지/재개)
    // @MessageMapping("/mission/control")
    // @PreAuthorize("@missionGuard.checkControlOwnership(authentication,
    // #controlDto.missionId)")
    // public void controlMission(@Payload PilotControlDto controlDto, Principal
    // principal) {
    // missionService.controlMission(principal.getName(), controlDto);
    // }
}