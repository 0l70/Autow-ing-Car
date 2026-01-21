package com.project.domain.robot.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.domain.robot.entity.RobotCommandHistory;

public interface RobotCommandHistoryRepository extends JpaRepository<RobotCommandHistory, String> {
    // DB 저장 메서드 예시
    // void saveSignal(String carId, String msgType, Object data);  
}
