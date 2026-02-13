package com.project.domain.mission.controller;

import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import com.project.domain.mission.service.MissionService;

import io.github.springwolf.core.asyncapi.annotations.AsyncListener;
import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 미션(운송) 관리 WebSocket Controller
 * 
 * 기장의 운송 요청 및 관제사의 승인/반려 처리
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class MissionWSController {

    private final MissionService missionService;

    // ========== Client → Server (SEND) ==========

    @MessageMapping("/mission/request")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/mission/request", description = "기장이 항공기 운송을 요청합니다. 안전 분석 데이터와 함께 관제사에게 승인 요청을 전송합니다."))
    // @PreAuthorize("@missionGuard.checkRequestOwnership(authentication,
    // #requestDto.flightId)") // TODO: WebSocket SecurityContext 이슈로 임시 주석
    public void requestMission(@Payload PilotRequestDto requestDto, Principal principal) {
        log.info("[WS] Mission Request: Pilot={}, FlightId={}", principal.getName(), requestDto.getFlightId());
        missionService.requestTransport(principal.getName(), requestDto);
    }

    @MessageMapping("/mission/decide")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/mission/decide", description = "관제사가 운송 요청을 승인하거나 반려합니다. 승인 시 미션이 시작됩니다."))
    // @PreAuthorize("@missionGuard.checkApprovePermission(authentication)") //
    // TODO: WebSocket SecurityContext 이슈로 임시 주석
    public void decideMission(@Payload ATCDecisionDto decisionDto, Principal principal) {
        log.info("[WS] ATC Decision: Admin={}, Approved={}", principal.getName(), decisionDto.isApproved());
        missionService.approveMission(principal.getName(), decisionDto);
    }

    // ========== Server → Client (SUBSCRIBE) - 문서화용 ==========

    @AsyncListener(operation = @AsyncOperation(channelName = "/topic/controller/requests", description = "모든 관제사에게 새로운 운송 요청과 안전 분석 데이터를 브로드캐스트합니다."))
    public void subscribeControllerRequests() {
        // 문서화용 - 실제 구현은 MissionWebSocketService.notifyAdminRequest()
    }

    @AsyncListener(operation = @AsyncOperation(channelName = "/topic/mission/updates", description = "전체 사용자에게 미션 상태 변경(시작/완료/취소)을 브로드캐스트합니다."))
    public void subscribeMissionUpdates() {
        // 문서화용 - 실제 구현은 MissionWebSocketService.broadcastMissionUpdate()
    }

    @AsyncListener(operation = @AsyncOperation(channelName = "/user/queue/reply", description = "기장에게 요청 결과(승인/반려)를 개별 전송합니다."))
    public void subscribePilotReply() {
        // 문서화용 - 실제 구현은 MissionWebSocketService.notifyPilotResult()
    }
}