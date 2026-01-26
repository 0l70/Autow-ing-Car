package com.project.domain.mission.entity;

import com.project.domain.common.MissionStatus;
import com.project.domain.flight.entity.Flight;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.user.entity.User;
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

    // 관계 매핑
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flight_schedule_id")
    private Flight flight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "towing_car_id")
    private TowingCar towingCar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "PILOT_ID") // User 테이블 참조
    private User pilot;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MissionStatus status; // WAITING, RUNNING...
    
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

    @Builder
    public Mission(User pilot, Flight flight, MissionStatus status, String departNode, String destNode) {
        this.pilot = pilot;
        this.flight = flight;
        this.status = status;
        this.departNode = departNode;
        this.destNode = destNode;
        this.assignedAt = LocalDateTime.now();
    }
    

    public void assignCar(TowingCar car, List<String> confirmedPath) {
        this.towingCar = car;
        this.routeEdgeIds = confirmedPath;
        this.assignedAt = LocalDateTime.now();
        car.assignMission(this.getId());
    }

    public void updateStatus(MissionStatus newStatus) {
        this.status = newStatus;
        if (newStatus == MissionStatus.RUNNING && this.startedAt == null) {
            this.startedAt = LocalDateTime.now();
        } else if (newStatus == MissionStatus.COMPLETED) {
            this.completedAt = LocalDateTime.now();
        }
    }


    public void setRouteEdgeIds(List<String> selectedEdgeIds) {
        this.routeEdgeIds = selectedEdgeIds;
    }
}