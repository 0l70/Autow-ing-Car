package com.project.domain.towingcar.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.domain.towingcar.entity.TowingCarCommandHistory;

public interface TowingCarCommandHistoryRepository extends JpaRepository<TowingCarCommandHistory, String> {
    // DB 저장 메서드 예시
    // void saveSignal(String carId, String msgType, Object data);  
}
