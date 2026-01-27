package com.project.domain.flight.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.repository.FlightRepository;
import com.project.domain.towingcar.entity.TowingCar;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class FlightDBAdaptor {
    private final FlightRepository flightRepository;

    public Flight getFlightById(Long id) {
        return flightRepository.findById(id).orElse(null);
    }

    public Flight getFlightByFlightNumber(String flightNumber) {
        return flightRepository.findByFlightNumber(flightNumber)
                .orElseThrow(() -> new IllegalArgumentException("No Flight: " + flightNumber));
    }

    public Flight save(Flight flight) {
        return flightRepository.save(flight);
    }

    public Flight findFlightByTowingCar(com.project.domain.towingcar.entity.TowingCar towingCar) {
        return flightRepository.findByTowingCar(towingCar)
                .orElseThrow(() -> new IllegalArgumentException("No Flight for TowingCar: " + towingCar.getCode()));
    }

    public Flight getFlightByAssignedCar(TowingCar car) {
        // TODO Auto-generated method stub
        return flightRepository.findByTowingCar(car)
                .orElseThrow(() -> new IllegalArgumentException("No Flight for TowingCar: " + car.getCode()));
    }

    public void delete(Flight flight) {
        flightRepository.delete(flight);    
    }
}