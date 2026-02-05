import { useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { flightApi } from '@/entities/mission/api/flightApi';
import { useSyncStore } from '@/shared/model/syncStore';
import { LoadingSplash } from '@/shared/ui/LoadingSplash';

interface PilotInitializerProps {
    children: ReactNode;
}

/**
 * PilotInitializer
 * 기장(PILOT) 권한인 경우에만 동작하며,
 * 새로고침 시 증발된 비행 정보를 REST로 복구합니다.
 */
export function PilotInitializer({ children }: PilotInitializerProps) {
    // Note: 싱크 로직이 SocketBridge로 통합되었으므로, 
    // 이곳은 이제 단순히 권한별 컴포넌트 마운트 지점 역할만 수행합니다.
    return <>{children}</>;
}

