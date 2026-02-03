package com.project.global.auth;

import com.project.global.error.domain.auth.InvalidJwtTokenException;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Collection;
import java.util.Date;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JwtTokenProvider {

    private final CustomUserDetailsService userDetailsService;

    private final Key key;

    // Token Types
    private final String TOKEN_TYPE_SOCKET = "SOCKET";
    private final String TOKEN_TYPE_ACCESS = "ACCESS";
    private final String TOKEN_TYPE_REFRESH = "REFRESH";

    // Token Validity Periods
    private static final long ACCESS_TOKEN_VALIDITY = 900_000L; // 15분
    private static final long REFRESH_TOKEN_VALIDITY = 604_800_000L; // 7일
    private static final long SOCKET_TOKEN_VALIDITY = 60_000L; // 1분

    public JwtTokenProvider(
            CustomUserDetailsService userDetailsService,
            @Value("${jwt.secret}") String secret) {
        this.userDetailsService = userDetailsService;
        byte[] keyBytes = io.jsonwebtoken.io.Decoders.BASE64.decode(secret);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    // Access Token 생성 (15분)
    public String createToken(Authentication authentication) {
        return buildToken(authentication, ACCESS_TOKEN_VALIDITY, TOKEN_TYPE_ACCESS);
    }

    // Refresh Token 생성 (7일)
    public String createRefreshToken(Authentication authentication) {
        return buildToken(authentication, REFRESH_TOKEN_VALIDITY, TOKEN_TYPE_REFRESH);
    }

    /**
     * WEBSOCKET용 토큰 생성 (짧은 유효기간)
     * 
     * }
     * 
     * /**
     * 
     * @param authentication
     * @return
     */
    public String createSocketToken(Authentication authentication) {
        return buildToken(authentication, SOCKET_TOKEN_VALIDITY, TOKEN_TYPE_SOCKET);
    }

    private String buildToken(Authentication authentication, long duration, String type) {
        String authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.joining(","));

        long now = (new Date()).getTime();
        Date validity = new Date(now + duration); // duration 파라미터 사용

        return Jwts.builder()
                .setSubject(authentication.getName()) // Employee Code 사용
                .claim("auth", authorities)
                .claim("token_type", type)
                .setIssuedAt(new Date(now))
                .setExpiration(validity)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();

    }

    public String getUserId(String token) {
        return parseClaims(token).getSubject();
    }

    /*
     * 소켓 토큰인지 확인
     */
    public boolean isSocketToken(String token) {
        try {
            String type = parseClaims(token).get("token_type", String.class);
            log.info("토큰 타입: {}", type);
            return TOKEN_TYPE_SOCKET.equals(type);
        } catch (Exception e) {
            log.error("토큰 타입 확인 실패: {}", e.getMessage());
            return false;
        }
    }

    /*
     * Refresh 토큰인지 확인
     */
    public boolean isRefreshToken(String token) {
        try {
            String type = parseClaims(token).get("token_type", String.class);
            return TOKEN_TYPE_REFRESH.equals(type);
        } catch (Exception e) {
            log.error("토큰 타입 확인 실패: {}", e.getMessage());
            return false;
        }
    }

    // 인증 정보 조회 (Access Token용)
    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);

        if (claims.get("auth") == null) {
            throw new InvalidJwtTokenException();
        }

        // CustomUserDetailsService를 통해 실제 CustomUserDetails 로드
        String userId = claims.getSubject();
        UserDetails principal = userDetailsService.loadUserByUsername(userId);

        Collection<? extends GrantedAuthority> authorities = principal.getAuthorities();
        return new UsernamePasswordAuthenticationToken(principal, token, authorities);
    }

    // Refresh Token에서 사용자 ID 추출 (auth claim 불필요)
    public String getUserIdFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    // 토큰 검증
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (io.jsonwebtoken.security.SecurityException | MalformedJwtException e) {
            log.info("잘못된 JWT 서명입니다.");
        } catch (ExpiredJwtException e) {
            log.info("만료된 JWT 토큰입니다.");
        } catch (UnsupportedJwtException e) {
            log.info("지원되지 않는 JWT 토큰입니다.");
        } catch (IllegalArgumentException e) {
            log.info("JWT 토큰이 잘못되었습니다.");
        }
        return false;
    }

    private Claims parseClaims(String accessToken) {
        try {
            return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(accessToken).getBody();
        } catch (ExpiredJwtException e) {
            return e.getClaims();
        }
    }
}
