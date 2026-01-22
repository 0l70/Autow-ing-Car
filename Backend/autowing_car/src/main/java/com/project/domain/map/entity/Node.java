package com.project.domain.map.entity;

import com.project.domain.common.EntityStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "node")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Node {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "node_id")
    private Long id;

    @Column(name = "node_code", unique = true, length = 30)
    private String nodeCode;

    @Column(name = "pos_x", nullable = false)
    private Double posX;

    @Column(name = "pos_y", nullable = false)
    private Double posY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntityStatus status; // AVAILABLE, BLOCKED

    @Column(name = "restriction_info", length = 50)
    private String restrictionInfo;
}