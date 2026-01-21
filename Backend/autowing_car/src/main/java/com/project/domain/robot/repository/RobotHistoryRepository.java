package com.project.domain.robot.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.domain.robot.entity.RobotHistory;

/**
 * - 로봇 로그용 레포지토리
 * - 로봇 신호 데이터를 데이터베이스에 저장하는 기능을 담당하는 리포지토리 클래스
 * - 실제 DB 연동 로직은 구현되지 않았으며, 필요에 따라 확장 가능
 * - 추후 RobotSignalService에서 DB 저장 기능 활성화 시 사용
 */

public interface RobotHistoryRepository extends JpaRepository<RobotHistory, Long> {
    // DB 저장 메서드 예시
    // void saveSignal(String carId, String msgType, Object data);
}
