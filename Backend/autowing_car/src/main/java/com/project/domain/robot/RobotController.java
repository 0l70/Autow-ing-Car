package com.project.domain.robot;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/robot")
@RequiredArgsConstructor
public class RobotController {

    private final RobotMqttService robotMqttService;

    // 비상 정지 명령
    @PostMapping("/stop")
    public ResponseEntity<String> emergencyStop() {
        String jsonCommand = "{\"type\": \"EMERGENCY_STOP\"}";
        robotMqttService.sendCommandToRobot(jsonCommand);
        return ResponseEntity.ok("정지 명령 전송 완료");
    }
    
    // 웨이포인트(목표지점) 전송
    @PostMapping("/move")
    public ResponseEntity<String> moveTo(@RequestBody Map<String, Double> target) {
        // {"lat": 36.5, "lng": 127.5}
        String jsonCommand = String.format("{\"type\": \"MOVE\", \"lat\": %f, \"lng\": %f}", 
                                           target.get("lat"), target.get("lng"));
        robotMqttService.sendCommandToRobot(jsonCommand);
        return ResponseEntity.ok("이동 명령 전송 완료");
    }
}