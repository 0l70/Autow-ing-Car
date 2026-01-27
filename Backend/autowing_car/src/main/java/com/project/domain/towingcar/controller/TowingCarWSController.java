package com.project.domain.towingcar.controller;

import java.util.Map;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import com.project.domain.towingcar.service.TowingCarService;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class TowingCarWSController {

    private final TowingCarService towingCarService;

    // 기장 -> 서버: "차량 보내주세요"
    @MessageMapping("/towingcar/dispatch")
    public void dispatchCar(@Payload Map<String, String> payload) {
        String flightNumber = payload.get("flightNumber");
        towingCarService.dispatchCarToFlight(flightNumber);
    }
}