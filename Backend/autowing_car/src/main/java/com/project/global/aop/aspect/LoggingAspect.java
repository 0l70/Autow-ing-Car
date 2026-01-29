package com.project.global.aop.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 서비스 메서드 실행 로깅 Aspect
 * 
 * 모든 Service 클래스의 메서드 실행을 자동으로 로깅
 * - 메서드 시작/종료
 * - 실행 시간 측정
 * - 에러 발생 시 로깅
 * - 성능 모니터링 (1초 이상 걸리면 경고)
 */
@Slf4j
@Aspect
@Component
@Order(1) // 가장 먼저 실행
public class LoggingAspect {

    private static final long SLOW_EXECUTION_THRESHOLD_MS = 1000;
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss.SSS");

    /**
     * 모든 Service 메서드 실행 로깅
     * 
     * Pointcut: com.project.domain..service.*Service.*(..)
     */
    @Around("execution(* com.project.domain..service.*Service.*(..))")
    public Object logServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String currentTime = getCurrentTime();

        long startTime = System.currentTimeMillis();

        // 메서드 시작 로그
        log.info("▶️  [{}] {}.{}() started", currentTime, className, methodName);

        try {
            // 실제 메서드 실행
            Object result = joinPoint.proceed();

            long executionTime = System.currentTimeMillis() - startTime;

            // 성공 로그
            log.info("✅ [{}] {}.{}() completed in {}ms",
                    getCurrentTime(), className, methodName, executionTime);

            // 성능 경고 (1초 이상)
            if (executionTime > SLOW_EXECUTION_THRESHOLD_MS) {
                log.warn("⚠️  SLOW: {}.{}() took {}ms (threshold: {}ms)",
                        className, methodName, executionTime, SLOW_EXECUTION_THRESHOLD_MS);
            }

            return result;

        } catch (Exception ex) {
            long executionTime = System.currentTimeMillis() - startTime;

            // 에러 로그
            log.error("❌ [{}] {}.{}() failed after {}ms: {}",
                    getCurrentTime(), className, methodName,
                    executionTime, ex.getMessage());

            throw ex;
        }
    }

    /**
     * 현재 시간 포맷팅 (HH:mm:ss.SSS)
     */
    private String getCurrentTime() {
        return LocalDateTime.now().format(TIME_FORMATTER);
    }
}
