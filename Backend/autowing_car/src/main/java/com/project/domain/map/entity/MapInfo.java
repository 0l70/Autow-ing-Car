package com.project.domain.map.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "map_info")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class MapInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "map_id")
    private Long id;

    @Column(name = "map_code", unique = true, length = 30)
    private String mapCode;

    @Column(nullable = false)
    private Integer width; // 지도의 가로 픽셀 크기

    @Column(nullable = false)
    private Integer height; // 지도의 세로 픽셀 크기

    @Column(nullable = false)
    private Double resolution; // 1픽셀당 미터(m) 정밀도

    @Column(name = "origin_x")
    private Double originX; // 지도 원점 X 좌표

    @Column(name = "origin_y")
    private Double originY; // 지도 원점 Y 좌표

    @Column(name = "max_speed")
    private Double maxSpeed; // 해당 맵 내 차량 최대 허용 속도 (A* 휴리스틱용)

    @Column(name = "image_path")
    private String imagePath; // 지도 이미지 파일 경로 또는 이름

    @Column(name = "basic_map")
    private boolean basicMap; // 기본 지도 여부
}
