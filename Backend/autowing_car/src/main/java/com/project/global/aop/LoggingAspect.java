package com.project.global.aop;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Slf4j
@Aspect
@Component
public class LoggingAspect {

    // Define Pointcuts for Controllers and Services
    @Pointcut("within(com.project..*Controller)")
    public void controllerMethods() {
    }

    @Pointcut("within(com.project..*Service)")
    public void serviceMethods() {
    }

    // Exclude basic health check or frequent polling if needed

    @Around("controllerMethods() || serviceMethods()")
    public Object logMethodExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        Object[] args = joinPoint.getArgs();

        log.info("▶ [START] {} | Args: {}", methodName, Arrays.toString(args));

        long start = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - start;

            log.info("◀ [END] {} | Time: {}ms | Result: {}", methodName, duration, result);
            return result;
        } catch (Throwable e) {
            long duration = System.currentTimeMillis() - start;
            log.error("⚠ [ERROR] {} | Time: {}ms | Exception: {}", methodName, duration, e.getMessage());
            throw e;
        }
    }
}
