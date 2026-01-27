package com.project.domain.towingcar.repository;

import com.project.domain.common.CarStatus;
import com.project.domain.towingcar.entity.TowingCar;

import io.lettuce.core.dynamic.annotation.Param;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TowingCarRepository extends JpaRepository<TowingCar, Long> {
    // 차량 코드로 조회 (예: "TC01")
    Optional<TowingCar> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE) // 다른 트랜잭션이 끝날 때까지 대기
    @Query("SELECT t FROM TowingCar t WHERE t.code = :code")
    Optional<TowingCar> findByCodeForUpdate(@Param("code") String code);

    // 쉬고 있는 차들 다 가져와!
    List<TowingCar> findAllByCarStatus(CarStatus status);
    // 현재 사용 가능한(IDLE) 차량만 조회
    // List<TowingCar> findByStatus(EntityStatus status);

    Optional<TowingCar> findFirstByCarStatusOrderByBatteryDesc(CarStatus idle);
}