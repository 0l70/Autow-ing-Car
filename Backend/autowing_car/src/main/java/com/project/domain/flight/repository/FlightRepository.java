package com.project.domain.flight.repository;

import com.project.domain.flight.entity.Flight;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.user.entity.User;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FlightRepository extends JpaRepository<Flight, Long> {
    Optional<Flight> findByTowingCar(TowingCar towingCar);

    boolean existsByFlightNumber(String flightNumber);

    Optional<Flight> findByFlightNumber(String flightNumber);

    Optional<Flight> findByPilotAndDepartureDate(User pilot, LocalDate departureDate);

    Optional<Flight> findFirstByPilotAndDepartureDateOrderByScheduledTimeAsc(User pilot, LocalDate departureDate);

}
