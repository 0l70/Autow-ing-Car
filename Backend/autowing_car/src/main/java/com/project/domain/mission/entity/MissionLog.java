package com.project.domain.mission.entity;

import com.project.domain.common.LogType;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "mission_log", indexes = {
    @Index(name = "idx_mission_log_mission_id", columnList = "MISSION_ID")
})
public class MissionLog {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long id;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LogType type;

    // ★ FK 없이 ID값만 저장 (데이터 보존 및 성능)
    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "mission_id")
    private Long missionId;

    @Builder
    public MissionLog(String message, LogType type, Long actorId, Long missionId) {
        this.createdAt = LocalDateTime.now();
        this.message = message;
        this.type = type;
        this.actorId = actorId;
        this.missionId = missionId;
    }
}