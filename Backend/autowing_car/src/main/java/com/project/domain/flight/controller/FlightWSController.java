package com.project.domain.flight.controller;

import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.flight.service.FlightService;
import com.project.domain.towingcar.service.TowingCarWebSocketService;

import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 항공편 정보 WebSocket Controller
 * 
 * 기장의 항공편 정보 조회 처리
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class FlightWSController {

    private final FlightService flightService;
    private final TowingCarWebSocketService towingCarWebSocketService;

    @MessageMapping("/flight/info/request")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/flight/info/request", description = "기장이 자신의 항공편 정보를 요청합니다. 시스템이 현재 로그인한 기장의 항공편 정보를 조회하여 개별 응답합니다."))
    public void requestFlightInfo(Principal principal) {
        String pilotId = principal.getName();
        log.info("[WS] Flight info requested by: {}", pilotId);

        try {
            FlightInfoDto flightInfo = flightService.getFlightInfoByPilot(pilotId);
            towingCarWebSocketService.notifyPilotFlightInfo(pilotId, flightInfo);
            log.info("[WS] Flight info sent to: {}", pilotId);
        } catch (Exception e) {
            log.error("[WS] Failed to send flight info to {}: {}", pilotId, e.getMessage());
        }
    }
}
