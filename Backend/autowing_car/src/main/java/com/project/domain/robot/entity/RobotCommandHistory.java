package com.project.domain.robot.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

import com.project.domain.robot.dto.RobotCommandDTO;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "robot_command_history")
public class RobotCommandHistory {

    @Id
    @Column(name = "cmd_id")
    private String cmdId; // UUID

    @Column(nullable = false)
    private String carId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RobotCommandDTO.CommandType type; // MOVE, STOP...

    private String targetNode; // 목적지

    @Column(columnDefinition = "TEXT")
    private String parameters; // JSON String parameters

    // --- 결재 프로세스 상태 관리 ---
    @Enumerated(EnumType.STRING)
    @Setter // 상태 변경을 위해 Setter 허용 (혹은 비즈니스 메서드 작성)
    private CommandStatus status; 

    private LocalDateTime requestedAt; // 기장 요청 시간

    @Setter
    private LocalDateTime approvedAt;  // 관제사 승인 시간
    
    // --- 생성자 ---
    public RobotCommandHistory(RobotCommandDTO dto) {
        this.cmdId = dto.getCmdId();
        this.carId = dto.getCarId();
        this.type = dto.getType();
        this.targetNode = dto.getTargetNode();
        this.parameters = dto.getParams() != null ? dto.getParams().toString() : "{}";
        
        this.status = CommandStatus.REQUESTED; // 초기 상태: 승인 대기
        this.requestedAt = LocalDateTime.now();
    }

    // 상태 Enum 정의
    public enum CommandStatus {
        REQUESTED,  // 승인 대기중 (기장 -> 관제사)
        APPROVED,   // 승인 완료 (관제사 승인)
        REJECTED,   // 반려됨
        SENT,       // MQTT 전송 완료
        FAIL        // 전송 실패
    }
}