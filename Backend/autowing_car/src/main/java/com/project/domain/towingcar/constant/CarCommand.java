package com.project.domain.towingcar.constant;

public enum CarCommand {
    MOVE_TO_GATE("MOVE_TO_GATE"),
    CONNECT("CONNECT"),
    DISCONNECT("DISCONNECT"),
    START_TRANSPORT("START_TRANSPORT"),
    EMERGENCY_STOP("EMERGENCY_STOP"),
    SET_MODE("SET_MODE"),
    MOVE("MOVE"),
    RESUME("RESUME"); // [NEW] 푸시백 재개 명령

    private final String cmd;

    CarCommand(String cmd) {
        this.cmd = cmd;
    }

    public String getCmd() {
        return cmd;
    }
}
