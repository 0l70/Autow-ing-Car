package com.project.global.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JwtTokenProvider {

    private final Key key;
    private final long tokenValidityInMilliseconds;
    private final String TOKEN_TYPE_SOCKET = "SOCKET";
    private final String TOKEN_TYPE_ACCESS = "ACCESS";

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long tokenValidityInMilliseconds) {
        byte[] keyBytes = io.jsonwebtoken.io.Decoders.BASE64.decode(secret);
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.tokenValidityInMilliseconds = tokenValidityInMilliseconds;
    }

    // Access Token 생성
    public String createToken(Authentication authentication) {
        return buildToken(authentication, this.tokenValidityInMilliseconds, TOKEN_TYPE_ACCESS);
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
        return buildToken(authentication, 1000000, TOKEN_TYPE_SOCKET); // 10000ms = 10초
    }

    private String buildToken(Authentication authentication, long duration, String type) {
        String authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.joining(","));

        long now = (new Date()).getTime();
        Date validity = new Date(now + 3600000); // 1시간 유효 (테스트용)

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

    // 인증 정보 조회
    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);

        if (claims.get("auth") == null) {
            throw new RuntimeException("권한 정보가 없는 토큰입니다.");
        }

        Collection<? extends GrantedAuthority> authorities = Arrays.stream(claims.get("auth").toString().split(","))
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        UserDetails principal = new User(claims.getSubject(), "", authorities);
        return new UsernamePasswordAuthenticationToken(principal, token, authorities);
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
