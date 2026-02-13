package com.project.domain.towingcar.controller;

import com.project.domain.towingcar.dto.TowingCarStatusResponse;
import com.project.domain.towingcar.service.TowingCarService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/towing-car")
@RequiredArgsConstructor
public class TowingCarController {

    private final TowingCarService towingCarService;

    @GetMapping("/status")
    public ResponseEntity<TowingCarStatusResponse> getMyTowingCarStatus(
            @AuthenticationPrincipal UserDetails userDetails) {
        // userDetails.getUsername() is the Pilot ID (Email)
        String pilotId = userDetails.getUsername();
        log.info("[API] Initial Status Request by Pilot: {}", pilotId);

        TowingCarStatusResponse status = towingCarService.getTowingCarStatusByPilot(pilotId);
        return ResponseEntity.ok(status);
    }

    @GetMapping
    public ResponseEntity<java.util.List<TowingCarStatusResponse>> getAllTowingCars() {
        log.info("[API] Request for all towing cars status");
        return ResponseEntity.ok(towingCarService.getAllTowingCars());
    }
}
