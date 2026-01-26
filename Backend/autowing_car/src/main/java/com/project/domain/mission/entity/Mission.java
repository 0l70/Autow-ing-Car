package com.project.domain.mission.entity;

import com.project.domain.common.MissionStatus;
import com.project.domain.common.MissionType;
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
    @JoinColumn(name = "flight_schedule_id")
    private Flight flight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "towing_car_id")
    private TowingCar towingCar;

    @Column(name = "pilot_id", updatable = false)
    private String pilotId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MissionStatus status; // WAITING, RUNNING...
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MissionType type;
    
    @Column(name = "depart_node", length = 30)
    private String departNode;

    @Column(name = "dest_node", length = 30)
    private String destNode;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // JSON 타입 처리: List<String> <-> JSON String
    @Convert(converter = StringListConverter.class)
    @Column(name = "route_edge_ids", columnDefinition = "TEXT")
    private List<String> routeEdgeIds;

    public void updateStatus(MissionStatus newStatus) {
        this.status = newStatus;
    }

    public void assignCar(TowingCar car, List<String> confirmedPath) {
        this.towingCar = car;
        this.routeEdgeIds = confirmedPath;
        this.assignedAt = LocalDateTime.now();
    }
}