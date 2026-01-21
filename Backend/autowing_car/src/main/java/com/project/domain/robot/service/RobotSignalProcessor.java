package com.project.domain.robot.service;

public interface RobotSignalProcessor {

    /**
     * 신호를 처리하고 WebSocket을 통해 브로드캐스트합니다.
     * @param topic
     * @param message
     */
    void processAndBroadcast(String topic, String message);
}
