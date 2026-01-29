package com.project.infra.mqtt.service;

public interface MqttService {
    /**
     * 특정 토픽으로 객체(Payload)를 JSON으로 변환하여 전송
     */
    void publish(String topic, Object payload);
}
