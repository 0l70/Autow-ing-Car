package com.project.global.aop.aspect;

import com.project.domain.mission.entity.Mission;
import com.project.domain.mission.service.MissionDBAdaptor;
import com.project.domain.towingcar.entity.DrivingLog;
import com.project.domain.towingcar.entity.TowingCar;
import com.project.domain.towingcar.service.TowingCarDBAdaptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * DrivingLog 자동 저장 Aspect
 * 
 * TowingCar.updateStatus() 호출 시 자동으로 DrivingLog를 DB에 저장
 * 서비스 레이어에서 saveDrivingLog() 호출 불필요
 */
@Slf4j
@Aspect
@Component
@Order(10) // 로깅 Aspect보다 나중에 실행
@RequiredArgsConstructor
public class DrivingLogAspect {

    private final TowingCarDBAdaptor towingCarDBAdaptor;
    private final MissionDBAdaptor missionDBAdaptor;

    /**
     * TowingCar.updateStatus() 실행 후 자동으로 DrivingLog 저장
     * 
     * Pointcut: com.project.domain.towingcar.entity.TowingCar.updateStatus(..)
     */
    @AfterReturning(pointcut = "execution(* com.project.domain.towingcar.entity.TowingCar.updateStatus(..))")
    public void saveDrivingLog(JoinPoint joinPoint) {
        try {
            // 메서드가 실행된 TowingCar 객체 가져오기
            TowingCar car = (TowingCar) joinPoint.getTarget();

            // 현재 미션 정보 조회 (있는 경우)
            Mission mission = null;
            if (car.getCurrentMissionId() != null) {
                try {
                    mission = missionDBAdaptor.getMissionById(car.getCurrentMissionId());
                } catch (Exception e) {
                    log.warn("Failed to fetch mission for DrivingLog: {}", e.getMessage());
                }
            }

            // DrivingLog 생성 및 저장
            DrivingLog log = DrivingLog.builder()
                    .towingCarId(car.getId())
                    .missionId(mission != null ? mission.getId() : null)
                    .carStatus(car.getCarStatus())
                    .missionStatus(mission != null ? mission.getStatus() : null)
                    .posX(car.getLastPosX())
                    .posY(car.getLastPosY())
                    .heading(car.getLastHeading())
                    .velocity(car.getLastVelocity())
                    .battery(car.getBattery())
                    .build();

            towingCarDBAdaptor.saveDrivingLog(log);

            log.debug("📝 [DrivingLog] Auto-saved: car={}, status={}, pos=({}, {})",
                    car.getCode(), car.getCarStatus(), car.getLastPosX(), car.getLastPosY());

        } catch (Exception ex) {
            // DrivingLog 저장 실패는 비즈니스 로직에 영향을 주지 않음
            log.error("❌ [DrivingLog] Failed to auto-save", ex);
        }
    }
}
