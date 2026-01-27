package com.project.domain.aircraft.service;

import org.springframework.stereotype.Component;

import com.project.domain.aircraft.entity.Aircraft;
import com.project.domain.aircraft.repository.AircraftRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AircraftDBAdaptor {
    private final AircraftRepository aircraftRepository;

    public Aircraft getAircraftByRegistrationNum(String registrationNum) {
        return aircraftRepository.indByRegistrationNum(registrationNum)
                .orElseThrow(() -> new IllegalArgumentException("No Aircraft: " + registrationNum));
    }

    public Aircraft registerAircraft(Aircraft aircraft) {
        return aircraftRepository.save(aircraft);
    }

    public void deleteAircraft(Aircraft aircraft) {
        aircraftRepository.delete(aircraft);
    }

    public void updateAircraft(Aircraft aircraft) {
        aircraftRepository.save(aircraft);
    }
}
