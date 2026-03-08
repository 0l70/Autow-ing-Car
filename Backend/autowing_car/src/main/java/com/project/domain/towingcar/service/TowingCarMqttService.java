package com.project.domain.towingcar.service;

import com.project.domain.towingcar.constant.CarCommand;
import com.project.infra.mqtt.constant.MqttTopics;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import org.springframework.beans.factory.annotation.Value; // [NEW]

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarMqttService {

    private final MqttService mqttService;

    // [Internal] Helper for publishing to Control Topic
    private void publishControl(String carCode, Map<String, Object> payload) {
        mqttService.publish(MqttTopics.cmdControl(carCode), payload);
    }

    public void connectCar(String carCode, Long flightId) {
        publishControl(carCode, Map.of("cmd", CarCommand.CONNECT.getCmd(), "flightId", flightId));
    }

    public void disconnectCar(String carCode, Long flightId) {
        publishControl(carCode, Map.of("cmd", CarCommand.DISCONNECT.getCmd(), "flightId", flightId));
    }

    public void emergencyStop(String carCode) {
        publishControl(carCode, Map.of("cmd", CarCommand.EMERGENCY_STOP.getCmd()));
    }

    public void setMode(String carCode, String mode) {
        publishControl(carCode, Map.of("cmd", CarCommand.SET_MODE.getCmd(), "mode", mode));
    }

    public void moveCar(String carCode, String type) {
        publishControl(carCode, Map.of("cmd", CarCommand.MOVE.getCmd(), "type", type));
    }

    // [Standardized] 이동 명령 전송 (Path based)
    public void sendDriveCommand(String carCode, Object payload) {
        String topic = MqttTopics.cmdDrive(carCode);
        mqttService.publish(topic, payload);
    }

    // [NEW] 푸시백 재개 명령
    public void resumeCar(String carCode) {
        publishControl(carCode, Map.of("cmd", CarCommand.RESUME.getCmd()));
    }
}
