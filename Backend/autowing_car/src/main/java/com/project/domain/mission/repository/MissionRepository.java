package com.project.domain.mission.repository;

import com.project.domain.mission.entity.Mission;
import com.project.domain.towingcar.entity.TowingCar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MissionRepository extends JpaRepository<Mission, Long> {

    // 1. 특정 차량이 현재 수행 중인(RUNNING, WAITING) 미션이 있는지 확인
    // (중복 할당 방지용)
    @Query("SELECT m FROM Mission m WHERE m.towingCar = :car AND m.status IN ('WAITING', 'RUNNING')")
    Optional<Mission> findActiveMissionByCar(@Param("car") TowingCar car);

    // 2. 특정 항공편에 배정된 미션 조회
    // Optional<Mission> findByFlight_Id(Long flightId);

    // 3. 최근 완료된 미션 순 조회 (이력용)
    List<Mission> findTop10ByTowingCarOrderByCompletedAtDesc(TowingCar towingCar);

    // 4. 특정 상태 리스트에 해당하는 미션들 조회
    List<Mission> findAllByStatusIn(java.util.Collection<com.project.domain.common.MissionStatus> statuses);

    // 5. [NEW] 차량 코드와 상태로 미션 조회 (Resume용)
    @Query("SELECT m FROM Mission m WHERE m.towingCar.code = :carCode AND m.status = :status")
    Optional<Mission> findByCarCodeAndStatus(@Param("carCode") String carCode,
            @Param("status") com.project.domain.common.MissionStatus status);
}