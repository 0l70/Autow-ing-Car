package com.project.domain.map.entity;

import com.project.domain.common.MapStatus;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "edge")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Edge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "edge_id")
    private Long id;

    @Column(name = "edge_code", unique = true, length = 30)
    private String edgeCode;

    // 출발 노드
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "src_node_id", nullable = false)
    private Node srcNode;

    // 도착 노드
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dst_node_id", nullable = false)
    private Node dstNode;

    @Column(nullable = false)
    private Double distance; // 좌표 갯수

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MapStatus status;

    @Column(name = "restriction_info", length = 50)
    private String restrictionInfo;

    @Column(name = "max_speed")
    private Integer maxSpeed;

    @Column(name = "waypoints", columnDefinition = "TEXT")
    private String waypoints; // JSON string of path coordinates

    @Column(name = "travel_time")
    private Double travelTime; // 해당 간선 통과 예상 시간 (단위: 초)

    public void updatePath(String waypoints, Double distance) {
        this.waypoints = waypoints;
        this.distance = distance;
    }

}