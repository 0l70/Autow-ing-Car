package com.project.domain.robot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RobotCommandDTO {

    @JsonProperty("cmd_id")
    @Builder.Default
    private String cmdId = UUID.randomUUID().toString();

    private String carId; // 내부 로직용 (JSON 변환 시 제외하고 싶다면 @JsonIgnore)

    @JsonProperty("type")
    private CommandType type;

    @JsonProperty("target_node")
    private String targetNode;

    @Builder.Default
    private Map<String, Object> params = Map.of();

    public enum CommandType {
        MOVE, STOP, PAUSE, RESUME, RESET
    }
}