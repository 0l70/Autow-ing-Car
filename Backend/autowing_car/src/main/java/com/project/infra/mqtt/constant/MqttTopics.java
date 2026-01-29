package com.project.infra.mqtt.constant;

public class MqttTopics {
    // 토픽 루트 (v1 버전 포함)
    public static final String BASE = "autowing_car/v1"; // autowing_car -> autowing/car (표준 권장)

    // 1. Inbound (로봇 -> 서버)
    // 위치, 상태(State), 배터리 등 모든 정보를 1초마다 한 번에 보냄
    // '+'는 와일드카드 (모든 로봇의 데이터 수신)
    public static final String SUB_MONITORING = BASE + "/monitoring";
    public static final String SUB_MAP_INFO = BASE + "/map"; // [NEW] Map Data Topic
    public static final String SUB_ACK = BASE + "/ack";

    // 2. Outbound Topic Generator
    public static String cmd(String carCode) {
        return String.format("%s/%s/cmd", BASE, carCode);
    }
}
