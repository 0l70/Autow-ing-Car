package com.project.domain.mission.entity;

import com.project.domain.common.EntityStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.global.util.StringListConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "mission")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mission_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flight_schedule_id", nullable = false)
    private Flight flight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "towing_car_id", nullable = false)
    private TowingCar towingCar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntityStatus status; // WAITING, RUNNING...

    @Column(name = "depart_node", nullable = false, length = 30)
    private String departNode;

    @Column(name = "dest_node", nullable = false, length = 30)
    private String destNode;

    @CreationTimestamp
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // JSON 타입 처리: List<String> <-> JSON String
    @Convert(converter = StringListConverter.class)
    @Column(name = "route_edge_ids", columnDefinition = "JSON")
    private List<String> routeEdgeIds;
}