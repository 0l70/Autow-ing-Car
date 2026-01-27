package com.project.global.auth.guard;

import com.project.domain.common.UserRole;
import com.project.domain.flight.entity.Flight;
import com.project.domain.flight.service.FlightDBAdaptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component("towingCarGuard")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TowingCarGuard {

    private final FlightDBAdaptor flightDBAdaptor;

    /**
     * [차량 연결/해제 권한 검증]
     * 1. PILOT 권한 확인
     * 2. Flight 소유권 확인
     */
    public boolean checkConnectionOwnership(Authentication authentication, Long flightId) {
        // 1. PILOT 권한 체크
        if (!hasRole(authentication, UserRole.PILOT)) {
            return false;
        }

        if (flightId == null)
            return false;

        // 2. Flight 소유권 체크
        Flight flight = flightDBAdaptor.getFlightById(flightId);
        if (flight == null || flight.getPilot() == null)
            return false;

        return flight.getPilot().getUsername().equals(authentication.getName());
    }

    private boolean hasRole(Authentication auth, UserRole role) {
        if (auth == null || !auth.isAuthenticated())
            return false;
        String roleName = role.name();
        for (GrantedAuthority authority : auth.getAuthorities()) {
            if (authority.getAuthority().equals(roleName) ||
                    authority.getAuthority().equals("ROLE_" + roleName)) {
                return true;
            }
        }
        return false;   
    }
}