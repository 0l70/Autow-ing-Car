package com.project.domain.aircraft.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "aircraft")
@Getter
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
public class Aircraft {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "aircraft_id")
    private Long id;

    @Column(name = "registration_num", nullable = false, unique = true, length = 20)
    private String registrationNum;

    @Column(name = "type_code", nullable = false, length = 30)
    private String typeCode;

    @Column(nullable = false)
    private Double width;

    @Column(nullable = false)
    private Double length;

    private String description;
}
