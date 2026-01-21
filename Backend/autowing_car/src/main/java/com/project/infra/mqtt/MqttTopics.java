package com.project.infra.mqtt;

public class MqttTopics {
    public static final String BASE = "autowing_car";

    // Inbound 구독용 (서버가 리스닝할 패턴: carId 자리에 '+' 사용)
    public static final String SUB_TELEMETRY = BASE + "/v1/robot/+/telemetry";
    public static final String SUB_STATE     = BASE + "/v1/robot/+/state";
    public static final String SUB_EVENT     = BASE + "/v1/robot/+/event";
    public static final String SUB_STATUS    = BASE + "/v1/robot/+/status";
    public static final String SUB_ACK       = BASE + "/v1/robot/+/ack";

    // Outbound 발행용 포맷 (서버가 보낼 때 String.format 사용)
    public static final String CMD_FORMAT = BASE + "/v1/robot/%s/cmd"; // %s: carId
}