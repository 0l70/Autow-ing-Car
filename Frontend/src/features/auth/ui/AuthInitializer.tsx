import { useEffect, useState, useRef, ReactNode } from 'react';
import { useAuthStore } from '../model/useAuthStore';
import { recoverSession } from '../api/sessionRecovery';
import { LoadingSplash } from '@/shared/ui/LoadingSplash';

interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * AuthInitializer
 * 앱 진입 시 세션 복구를 담당하는 Gatekeeper 컴포넌트.
 * 인증 상태가 확정될 때까지 하위 트리 렌더링을 차단합니다.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore();
  
  // 초기화 상태 관리 (액세스 토큰이 없고 리프레시 토큰이 있을 때만 true로 시작)
  const [isInitializing, setIsInitializing] = useState(() => {
    return !accessToken && !!refreshToken;
  });

  // 중복 요청 방지용 Ref
  const recoveryPromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    // 이미 액세스 토큰이 있거나 리프레시 토큰이 없으면 초기화 불필요
    if (accessToken || !refreshToken) {
      setIsInitializing(false);
      return;
    }

    let isMounted = true;

    async function initialize() {
      try {
        console.log('[AuthInitializer] 🔄 Attempting to recover session...');
        
        // Single-flight: 이미 진행 중인 요청이 있다면 기다림
        if (!recoveryPromiseRef.current) {
          recoveryPromiseRef.current = recoverSession(refreshToken!);
        }
        
        const data = await recoveryPromiseRef.current;

        if (isMounted) {
          setTokens(data.accessToken, data.refreshToken, data.socketToken);
          console.log('[AuthInitializer] ✅ Session restored successfully.');
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        console.error('[AuthInitializer] ❌ Session recovery failed:', error);
        
        // 401, 403 등 인증 만료 시 로그아웃 처리
        if (error.status === 401 || error.status === 403) {
            logout();
        } else {
            // 기타 에러(서버 다운 등) 발생 시에도 안전을 위해 일단 로그아웃 처리하거나 
            // 프로젝트 정책에 따라 에러 페이지 노출
            logout();
        }
      } finally {
        recoveryPromiseRef.current = null;
        if (isMounted) setIsInitializing(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [accessToken, refreshToken, setTokens, logout]);

  // 세션 복구 중일 때 로딩 화면 노출
  if (isInitializing) {
    return <LoadingSplash message="Restoring ATC Session..." />;
  }

  return <>{children}</>;
}
