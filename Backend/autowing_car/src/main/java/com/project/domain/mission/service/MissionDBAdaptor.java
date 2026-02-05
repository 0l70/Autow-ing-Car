package com.project.domain.mission.service;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.project.domain.common.LogType;
import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.entity.MissionLog;
import com.project.domain.mission.repository.MissionLogRepository;
import com.project.domain.mission.repository.MissionRepository;

import lombok.RequiredArgsConstructor;

@Component
@Transactional
@RequiredArgsConstructor
public class MissionDBAdaptor {
    private final MissionRepository missionRepository;
    private final MissionLogRepository missionLogRepository;

    public Mission getMissionById(Long id) {
        return missionRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("No Mission: " + id));
    }

    public Mission save(Mission mission) {
        return missionRepository.save(mission);
    }

    public MissionLog findLogById(Long id) {
        return missionLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("No MissionLog: " + id));
    }

    public List<MissionLog> findLogByCarId(Long carId) {
        return missionLogRepository.findAllByCarIdOrderByCreatedAtDesc(carId);
    }

    public MissionLog saveLog(Mission mission, LogType logType, String message) {
        MissionLog log = MissionLog.builder()
                .missionId(mission.getId())
                .type(logType)
                .message(message)
                .build();
        return missionLogRepository.save(log);
    }

    public Mission findActiveMissionByCar(com.project.domain.towingcar.entity.TowingCar car) {
        return missionRepository.findActiveMissionByCar(car).orElse(null);
    }

    public List<Mission> findActiveMissions() {
        return missionRepository.findAllByStatusIn(List.of(
                com.project.domain.common.MissionStatus.RUNNING,
                com.project.domain.common.MissionStatus.PAUSED));
    }
}
