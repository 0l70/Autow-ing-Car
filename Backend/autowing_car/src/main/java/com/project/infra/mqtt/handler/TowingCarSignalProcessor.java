package com.project.infra.mqtt.handler;

public interface TowingCarSignalProcessor {
    // "이 토픽으로 이런 내용이 왔으니 알아서 처리해라"
    void processAndBroadcast(String topic, String payload);
}