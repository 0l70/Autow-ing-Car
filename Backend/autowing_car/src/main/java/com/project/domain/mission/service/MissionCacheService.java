package com.project.domain.mission.service;

import com.project.domain.mission.dto.MissionWebSocketDtos.MissionResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class MissionCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Key Pattern: mission:{missionId}
    private static final String KEY_PREFIX = "mission:";
    private static final Duration CACHE_TTL = Duration.ofDays(1); // Cache active missions

    public void saveMission(MissionResponseDto missionDto) {
        String key = KEY_PREFIX + missionDto.getMissionId();
        try {
            redisTemplate.opsForValue().set(key, missionDto, CACHE_TTL);
            log.debug("💾 [Redis] Saved Mission: {}", missionDto.getMissionId());
        } catch (Exception e) {
            log.error("❌ [Redis] Failed to save mission {}: {}", missionDto.getMissionId(), e.getMessage());
        }
    }

    public MissionResponseDto getMission(Long missionId) {
        String key = KEY_PREFIX + missionId;
        try {
            Object data = redisTemplate.opsForValue().get(key);
            if (data instanceof MissionResponseDto) {
                return (MissionResponseDto) data;
            }
        } catch (Exception e) {
            log.error("❌ [Redis] Failed to get mission {}: {}", missionId, e.getMessage());
        }
        return null;
    }

    public void deleteMission(Long missionId) {
        redisTemplate.delete(KEY_PREFIX + missionId);
    }
}
