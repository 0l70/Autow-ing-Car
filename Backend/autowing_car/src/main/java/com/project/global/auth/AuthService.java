package com.project.global.auth;

import com.project.domain.user.entity.User;
import com.project.global.auth.dto.AuthDtos;
import com.project.global.auth.repository.RefreshTokenRepository;
import com.project.global.error.domain.auth.InvalidJwtTokenException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

        private final AuthenticationManagerBuilder authenticationManagerBuilder;
        private final JwtTokenProvider jwtTokenProvider;
        private final RefreshTokenRepository refreshTokenRepository;
        private final CustomUserDetailsService userDetailsService;

        private static final long REFRESH_TOKEN_VALIDITY = 604_800_000L; // 7일

        // @Transactional (Removed for Performance: DB Connection holding time
        // optimization)
        public AuthDtos.TokenResponse login(AuthDtos.LoginRequest request) {
                // 1. Login ID/PW 기반으로 Authentication 객체 생성
                // 이때 authentication 은 인증 여부를 확인하는 authenticated 값이 false
                UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                                request.getEmail(), request.getPassword());

                // 2. 실제 검증 (사용자 비밀번호 체크)
                // authenticate 매서드가 실행될 때 CustomUserDetailsService 에서 만든 loadUserByUsername
                // 메서드가 실행
                Authentication authentication = authenticationManagerBuilder.getObject()
                                .authenticate(authenticationToken);

                // 3. 인증 정보를 기반으로 JWT 토큰 생성
                String accessToken = jwtTokenProvider.createToken(authentication);

                // 4. 소켓용 단기 토큰 생성
                String socketToken = jwtTokenProvider.createSocketToken(authentication);

                // 5. Refresh Token 생성
                String refreshToken = jwtTokenProvider.createRefreshToken(authentication);

                // 6. 유저 정보 조회 (Role 반환용) - 인증 정보에서 직접 가져오도록 수정
                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
                User user = userDetails.getUser();

                // 7. Refresh Token을 Redis에 저장
                refreshTokenRepository.save(user.getEmail(), refreshToken, REFRESH_TOKEN_VALIDITY);

                return AuthDtos.TokenResponse.builder()
                                .grantType("Bearer")
                                .accessToken(accessToken)
                                .refreshToken(refreshToken)
                                .socketToken(socketToken)
                                .role(user.getRole())
                                .build();
        }

        // [Reconnection] Existing Auth -> New Socket Token
        public String createSocketTokenFromAuth() {
                Authentication authentication = org.springframework.security.core.context.SecurityContextHolder
                                .getContext()
                                .getAuthentication();
                return jwtTokenProvider.createSocketToken(authentication);
        }

        /**
         * Refresh Token으로 새로운 Access Token + Socket Token 발급
         * Refresh Token Rotation: 새 Refresh Token도 함께 발급
         */
        @Transactional
        public AuthDtos.TokenResponse refreshToken(String refreshToken) {
                // 1. Refresh Token 검증
                if (!jwtTokenProvider.validateToken(refreshToken)) {
                        throw new InvalidJwtTokenException();
                }

                // 2. Refresh Token 타입 확인
                if (!jwtTokenProvider.isRefreshToken(refreshToken)) {
                        throw new InvalidJwtTokenException();
                }

                // 3. 토큰에서 사용자 정보 추출
                String userId = jwtTokenProvider.getUserId(refreshToken);

                // 4. Redis에서 저장된 Refresh Token 확인
                String storedToken = refreshTokenRepository.findByUserId(userId)
                                .orElseThrow(() -> new InvalidJwtTokenException());

                // 5. 토큰 일치 확인 (재사용 방지)
                if (!refreshToken.equals(storedToken)) {
                        // 재사용 감지! 모든 토큰 무효화
                        refreshTokenRepository.deleteByUserId(userId);
                        throw new InvalidJwtTokenException();
                }

                // 6. 사용자 정보 로드
                UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
                Authentication authentication = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());

                // 7. 새로운 토큰 세트 발급
                String newAccessToken = jwtTokenProvider.createToken(authentication);
                String newSocketToken = jwtTokenProvider.createSocketToken(authentication);
                String newRefreshToken = jwtTokenProvider.createRefreshToken(authentication);

                // 8. 새 Refresh Token으로 교체 (Rotation)
                refreshTokenRepository.save(userId, newRefreshToken, REFRESH_TOKEN_VALIDITY);

                // 9. 역할 정보 조회
                CustomUserDetails customUserDetails = (CustomUserDetails) userDetails;
                User user = customUserDetails.getUser();

                return AuthDtos.TokenResponse.builder()
                                .grantType("Bearer")
                                .accessToken(newAccessToken)
                                .refreshToken(newRefreshToken)
                                .socketToken(newSocketToken)
                                .role(user.getRole())
                                .build();
        }

        /**
         * 로그아웃 - Redis에서 Refresh Token 삭제
         */
        public void logout(String userId) {
                refreshTokenRepository.deleteByUserId(userId);
        }
}
