package com.project.domain.flight.controller;

import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.flight.service.FlightService;
import com.project.infra.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Slf4j
@Controller
@RequiredArgsConstructor
public class FlightWSController {

    private final FlightService flightService;
    private final WebSocketService webSocketService;

    /**
     * 기장이 명시적으로 Flight 정보를 요청할 때 호출됨
     * 프론트에서 /app/flight/info/request 로 요청
     */
    @MessageMapping("/flight/info/request")
    public void requestFlightInfo(Principal principal) {
        String pilotId = principal.getName();
        log.info("[WS] Flight info requested by: {}", pilotId);

        try {
            FlightInfoDto flightInfo = flightService.getFlightInfoByPilot(pilotId);
            webSocketService.notifyPilotFlightInfo(pilotId, flightInfo);
            log.info("[WS] Flight info sent to: {}", pilotId);
        } catch (Exception e) {
            log.error("[WS] Failed to send flight info to {}: {}", pilotId, e.getMessage());
        }
    }
}
