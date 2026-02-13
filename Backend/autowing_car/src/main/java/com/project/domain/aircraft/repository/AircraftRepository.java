package com.project.domain.aircraft.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.domain.aircraft.entity.Aircraft;

@Repository
public interface AircraftRepository extends JpaRepository<Aircraft, Long> {
    Optional<Aircraft> findByRegistrationNum(String registrationNum);
}
