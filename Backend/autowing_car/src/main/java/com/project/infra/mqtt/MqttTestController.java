package com.project.infra.mqtt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.annotation.PostConstruct;

@RestController
@RequestMapping("/api/mqtt")
public class MqttTestController {

    static {
        System.out.println("🔥🔥🔥 MqttTestController CLASS LOADED");
    }
    private final MqttConfig.MqttGateway mqttGateway;
    @PostConstruct
    public void init() {
        System.out.println("🔥 MqttTestController REGISTERED");
    }
    public MqttTestController(MqttConfig.MqttGateway mqttGateway) {
        this.mqttGateway = mqttGateway;
    }

    @GetMapping("/publish")
    public String publish(@RequestParam String message) {
        mqttGateway.sendToMqtt(message);
        return "발행 성공: " + message;
    }
}