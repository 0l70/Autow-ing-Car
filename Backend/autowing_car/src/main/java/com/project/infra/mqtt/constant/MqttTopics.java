package com.project.infra.mqtt.constant;

public class MqttTopics {
    // 토픽 루트 (Legacy Support for Inbound)
    public static final String BASE = "autowing_car/v1";

    // 1. Inbound (로봇 -> 서버)
    // 기존 포맷 유지: autowing_car/v1/monitoring
    public static final String SUB_MONITORING = BASE + "/monitoring";
    public static final String SUB_MAP_INFO = BASE + "/map";
    public static final String SUB_ACK = BASE + "/ack";

    // 2. Outbound Topic Generator (Standardized V1)
    // Controller Request: autowing/v1/car/{carId}/cmd/drive
    public static String cmdDrive(String carCode) {
        return String.format("%s/%s/cmd/drive", BASE, carCode);
    }

    // Controller Request: autowing/v1/car/{carId}/cmd/control
    // 용도 : Mission 제어
    public static String cmdControl(String carCode) {
        return String.format("%s/%s/cmd/control", BASE, carCode);
    }
}
