package com.project.global.auth.repository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Refresh Token Redis 저장소
 * - Key: RT:{userId} (예: RT:pilot@atc.com)
 * - Value: refreshToken (JWT String)
 * - TTL: 7일 (자동 만료)
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class RefreshTokenRepository {

    private final RedisTemplate<String, String> redisTemplate;
    private static final String KEY_PREFIX = "RT:";

    /**
     * Refresh Token 저장
     * 
     * @param userId       사용자 ID (이메일)
     * @param refreshToken JWT Refresh Token
     * @param ttlInMs      유효기간 (밀리초)
     */
    public void save(String userId, String refreshToken, long ttlInMs) {
        String key = KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(key, refreshToken, ttlInMs, TimeUnit.MILLISECONDS);
        log.info("[RefreshToken] 저장 완료: userId={}, ttl={}ms", userId, ttlInMs);
    }

    /**
     * 사용자 ID로 Refresh Token 조회
     * 
     * @param userId 사용자 ID
     * @return Optional<RefreshToken>
     */
    public Optional<String> findByUserId(String userId) {
        String key = KEY_PREFIX + userId;
        String token = redisTemplate.opsForValue().get(key);
        return Optional.ofNullable(token);
    }

    /**
     * Refresh Token 삭제 (로그아웃)
     * 
     * @param userId 사용자 ID
     */
    public void deleteByUserId(String userId) {
        String key = KEY_PREFIX + userId;
        Boolean deleted = redisTemplate.delete(key);
        log.info("[RefreshToken] 삭제: userId={}, success={}", userId, deleted);
    }

    /**
     * Refresh Token 존재 여부 확인
     * 
     * @param refreshToken JWT String
     * @return true if exists
     */
    public boolean existsByToken(String refreshToken) {
        Set<String> keys = redisTemplate.keys(KEY_PREFIX + "*");
        if (keys != null) {
            for (String key : keys) {
                String storedToken = redisTemplate.opsForValue().get(key);
                if (refreshToken.equals(storedToken)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 모든 Refresh Token 삭제 (테스트용)
     */
    public void deleteAll() {
        Set<String> keys = redisTemplate.keys(KEY_PREFIX + "*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.info("[RefreshToken] 전체 삭제: count={}", keys.size());
        }
    }
}
