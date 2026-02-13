package com.project.domain.towingcar.service;

import com.project.domain.towingcar.dto.TowingCarStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TowingCarCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Key Pattern: towing_car:{carCode}
    private static final String KEY_PREFIX = "towing_car:";
    private static final Duration CACHE_TTL = Duration.ofHours(24); // Keep for a day (refresh on update)

    public void saveCarStatus(String carCode, TowingCarStatusResponse statusResponse) {
        String key = KEY_PREFIX + carCode;
        try {
            redisTemplate.opsForValue().set(key, statusResponse, CACHE_TTL);
            log.debug("💾 [Redis] Saved Car Status: {}", carCode);
        } catch (Exception e) {
            log.error("❌ [Redis] Failed to save car status for {}: {}", carCode, e.getMessage());
        }
    }

    public TowingCarStatusResponse getCarStatus(String carCode) {
        String key = KEY_PREFIX + carCode;
        try {
            Object data = redisTemplate.opsForValue().get(key);
            if (data instanceof TowingCarStatusResponse) {
                return (TowingCarStatusResponse) data;
            }
        } catch (Exception e) {
            log.error("❌ [Redis] Failed to get car status for {}: {}", carCode, e.getMessage());
        }
        return null; // Cache miss or error
    }

    public List<TowingCarStatusResponse> getAllCars() {
        List<TowingCarStatusResponse> list = new ArrayList<>();
        try {
            Set<String> keys = redisTemplate.keys(KEY_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                List<Object> values = redisTemplate.opsForValue().multiGet(keys);
                if (values != null) {
                    for (Object val : values) {
                        if (val instanceof TowingCarStatusResponse) {
                            list.add((TowingCarStatusResponse) val);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("❌ [Redis] Failed to get all cars: {}", e.getMessage());
        }
        return list;
    }

    public void deleteCarStatus(String carCode) {
        redisTemplate.delete(KEY_PREFIX + carCode);
    }
}
