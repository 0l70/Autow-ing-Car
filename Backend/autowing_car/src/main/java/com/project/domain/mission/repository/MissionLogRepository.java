package com.project.domain.mission.repository;

import com.project.domain.mission.entity.MissionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MissionLogRepository extends JpaRepository<MissionLog, Long> {
    // 특정 미션의 로그 전체 조회
    List<MissionLog> findByMissionIdOrderByCreatedAtDesc(Long missionId);

    List<MissionLog> findAllByCarIdOrderByCreatedAtDesc(Long carId);
}