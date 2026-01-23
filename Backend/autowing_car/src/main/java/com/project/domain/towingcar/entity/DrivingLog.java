package com.project.domain.towingcar.entity;

import com.project.domain.common.CarStatus;
import com.project.domain.common.MissionStatus;
import com.project.domain.mission.entity.Mission;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "driving_log", indexes = {
    @Index(name = "idx_driving_log_car_time", columnList = "towing_car_id, created_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DrivingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "towing_car_id", nullable = false)
    private TowingCar towingCar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id") // 미션 없이 이동할 수도 있으므로 Nullable
    private Mission mission;

    @Column(name = "pos_x", nullable = false)
    private Double posX;

    @Column(name = "pos_y", nullable = false)
    private Double posY;

    @Column(nullable = false)
    private Double heading;

    @Column(nullable = false)
    private Double velocity;

    @Column(nullable = false)
    private Integer battery;

    @Enumerated(EnumType.STRING)
    private CarStatus carStatus; // MOVING, IDLE, ERROR

    @Enumerated(EnumType.STRING)
    private MissionStatus missionStatus; // WAITING, RUNNING

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}