package com.project.domain.towingcar.repository;

import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.DrivingLogId;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DrivingLogRepository extends JpaRepository<DrivingLog, DrivingLogId> {

    List<DrivingLog> findAllByTowingCarIdOrderByCreatedAtDesc(Long towingCarId);
    // 로그는 주로 Insert 위주이므로 기본 메서드로 충분
}