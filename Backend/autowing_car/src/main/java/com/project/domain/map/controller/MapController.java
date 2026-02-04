package com.project.domain.map.controller;

import com.project.domain.map.dto.MapResponse;
import com.project.domain.map.service.MapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class MapController {

    private final MapService mapService;

    @GetMapping("/info")
    public ResponseEntity<MapResponse> getMapInfo(@RequestParam(defaultValue = "final_map") String mapId) {
        return ResponseEntity.ok(mapService.getFullMap(mapId));
    }
}
