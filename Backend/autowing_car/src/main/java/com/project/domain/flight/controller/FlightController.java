package com.project.domain.flight.controller;

import com.project.domain.flight.dto.FlightWebSocketDtos.FlightInfoDto;
import com.project.domain.flight.service.FlightService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "항공편", description = "항공편 정보 조회 API")
@Slf4j
@RestController
@RequestMapping("/api/flight")
@RequiredArgsConstructor
public class FlightController {

    private final FlightService flightService;

    @Operation(summary = "내 비행 정보 조회", description = "기장 권한 사용자가 자신의 오늘 비행 정보를 조회합니다.")
    @GetMapping("/info")
    public ResponseEntity<FlightInfoDto> getMyFlightInfo(@AuthenticationPrincipal UserDetails userDetails) {
        String pilotId = userDetails.getUsername();
        log.info("[API] Flight Info Request by Pilot: {}", pilotId);
        
        FlightInfoDto info = flightService.getFlightInfoByPilot(pilotId);
        return ResponseEntity.ok(info);
    }
}
