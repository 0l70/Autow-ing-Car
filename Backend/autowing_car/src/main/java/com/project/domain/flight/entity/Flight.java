package com.project.domain.flight.entity;

import com.project.domain.aircraft.entity.Aircraft;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "flight")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Flight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "flight_schedule_id")
    private Long id;

    @Column(name = "flight_number", length = 20, unique = true)
    private String flightNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aircraft_id")
    //  nullable = false)
    private Aircraft aircraft;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pilot_id")
    // , nullable = false)
    private User pilot;

    @OneToOne(fetch = FetchType.LAZY) 
    @JoinColumn(name = "assigned_towing_car_id")
    private TowingCar assignedTowingCar;

    @Column(name = "gate_number", length = 10)
    private String gateNumber;

    @Column(name = "departure_date")
    // nullable = false)
    private LocalDate departureDate;

    @Column(name = "scheduled_time")
    // nullable = false)
    private LocalDateTime scheduledTime;

    // 차량 배정 (Dispatch)
    public void assignCar(TowingCar car) {
        this.assignedTowingCar = car;
    }

    // 배정 해제 (완전히 미션 완료 후)
    public void releaseCar() {
        this.assignedTowingCar = null;
    }
}