package com.project.domain.robot.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;

@Entity
@Getter
public class RobotCommandLog {
    @Id
    private String commandId;

    private String carId;
    private String commandName;

    @Column(columnDefinition = "TEXT")
    private String parameters; // 아마 JSON 문자열 형태일 듯

    private String correlationId;

    private String status; // OK, ERROR
    private LocalDateTime requestedAt;
    private LocalDateTime respondedAt;

}
