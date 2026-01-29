package com.project.domain.towingcar.service;

import com.project.domain.towingcar.constant.CarCommand;
import com.project.infra.mqtt.constant.MqttTopics;
import com.project.infra.mqtt.service.MqttService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarMqttService {

    private final MqttService mqttService;

    // Type-safe sending method
    private void send(String carCode, CarCommand command, Object data) {
        String topic = MqttTopics.cmd(carCode);
        Map<String, Object> payload = Map.of(
                "cmd", command.getCmd(),
                "data", data != null ? data : Map.of());
        mqttService.publish(topic, payload);
    }

    public void moveCarToGate(String carCode, String targetNode) {
        send(carCode, CarCommand.MOVE_TO_GATE, Map.of("targetNode", targetNode));
    }

    public void connectCar(String carCode, Long flightId) {
        send(carCode, CarCommand.CONNECT, Map.of("flightId", flightId));
    }

    public void disconnectCar(String carCode, Long flightId) {
        send(carCode, CarCommand.DISCONNECT, Map.of("flightId", flightId));
    }

    public void startTransport(String carCode, Object data) {
        send(carCode, CarCommand.START_TRANSPORT, data);
    }
}
