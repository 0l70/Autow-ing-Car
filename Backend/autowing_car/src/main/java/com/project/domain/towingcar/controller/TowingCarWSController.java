package com.project.domain.towingcar.controller;

import java.security.Principal;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDispatchRequestDto;
import com.project.domain.towingcar.service.TowingCarService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TowingCarWSController {

    private final TowingCarService towingCarService;
    private final com.project.domain.mission.service.MissionService missionService;

    @MessageMapping("/car/dispatch")
    public void dispatchCar(@Payload CarDispatchRequestDto requestDto, Principal principal) {
        log.info("[WS] Dispatch Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightNumber());
        towingCarService.dispatchCarToFlight(requestDto.getFlightNumber());
    }

    // 시나리오 A: [기장] 차량 연결 요청
    @MessageMapping("/car/connect")
    public void connectCar(@Payload CarConnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Connect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.connectCar(principal.getName(), requestDto);
    }

    // 시나리오 C: [기장] 차량 연결 해제 요청
    @MessageMapping("/car/disconnect")
    public void disconnectCar(@Payload CarDisconnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Disconnect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.disconnectCar(principal.getName(), requestDto);
    }

    // 시나리오 B: [기장] 푸시백(이동) 요청 -> MissionService (어댑터 패턴 적용)
    @MessageMapping("/car/move")
    public void moveCar(@Payload com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarMoveRequestDto request,
            Principal principal) {
        if ("PUSHBACK".equals(request.getType())) {
            log.info("[WS] Pushback Request: Pilot={}, Flight={}", principal.getName(), request.getFlightId());

            // DTO 변환: CarMoveRequestDto -> PilotRequestDto
            com.project.domain.mission.dto.MissionWebSocketDtos.PilotRequestDto missionRequest = new com.project.domain.mission.dto.MissionWebSocketDtos.PilotRequestDto(
                    request.getFlightId());

            // MissionService로 위임 (책임 분리)
            missionService.requestTransport(principal.getName(), missionRequest);
        } else {
            log.warn("[WS] Unknown Move Type: {}", request.getType());
        }
    }

    // 시나리오 D: [기장] 차량 배정 요청

}