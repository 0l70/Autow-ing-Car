package com.project.domain.towingcar.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;
import com.project.domain.towingcar.service.TowingCarService;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import lombok.extern.slf4j.Slf4j;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TowingCarWSController {

    private final TowingCarService towingCarService;

    // 기장 -> 서버: "차량 보내주세요"
    // 시나리오 A: [기장] 차량 연결 요청
    @MessageMapping("/car/connect")
    @PreAuthorize("@towingCarGuard.checkConnectionOwnership(authentication, #requestDto.flightId)")
    public void connectCar(@Payload CarConnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Connect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.connectCar(principal.getName(), requestDto);
    }

    // 시나리오 C: [기장] 차량 연결 해제 요청
    @MessageMapping("/car/disconnect")
    @PreAuthorize("@towingCarGuard.checkConnectionOwnership(authentication, #requestDto.flightId)")
    public void disconnectCar(@Payload CarDisconnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Disconnect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.disconnectCar(principal.getName(), requestDto);
    }
}