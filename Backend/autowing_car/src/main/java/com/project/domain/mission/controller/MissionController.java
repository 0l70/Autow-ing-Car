package com.project.domain.mission.controller;

import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import com.project.domain.mission.service.MissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "미션", description = "미션 정보 조회 API")
@Slf4j
@RestController
@RequestMapping("/api/mission")
@RequiredArgsConstructor
public class MissionController {

    private final MissionService missionService;

    @Operation(summary = "활성 미션 목록 조회", description = "현재 진행 중인(RUNNING, PAUSED) 모든 미션 리스트를 조회합니다.")
    @GetMapping
    public ResponseEntity<Map<String, MissionResponseDto>> getActiveMissions() {
        log.info("[API] Request for all active missions");
        List<MissionResponseDto> missions = missionService.getAllActiveMissions();

        // 프론트엔드 Record<string, MissionInfo> 형식에 맞춰 Map으로 변환 (Key: TowingCarCode)
        Map<String, MissionResponseDto> missionMap = missions.stream()
                .filter(m -> m.getTowingCarCode() != null)
                .collect(Collectors.toMap(
                        MissionResponseDto::getTowingCarCode,
                        m -> m,
                        (existing, replacement) -> replacement));

        return ResponseEntity.ok(missionMap);
    }
}
