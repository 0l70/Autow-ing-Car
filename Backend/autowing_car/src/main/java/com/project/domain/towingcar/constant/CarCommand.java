package com.project.domain.towingcar.constant;

public enum CarCommand {
    MOVE_TO_GATE("MOVE_TO_GATE"),
    CONNECT("CONNECT"),
    DISCONNECT("DISCONNECT"),
    START_TRANSPORT("START_TRANSPORT");

    private final String cmd;

    CarCommand(String cmd) {
        this.cmd = cmd;
    }

    public String getCmd() {
        return cmd;
    }
}
