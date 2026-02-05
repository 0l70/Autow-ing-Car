import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Refresh 응답 스키마
export const SessionRecoverySchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    socketToken: z.string(),
});

export type SessionRecoveryResponse = z.infer<typeof SessionRecoverySchema>;

/**
 * [Session Recovery]
 * 새로고침 시 소실된 토큰을 복구하기 위한 전용 API 함수.
 * apiClient의 의존성(App state) 없이 독립적으로 fetch를 수행하여 순환 참조를 방지합니다.
 */
export async function recoverSession(refreshToken: string): Promise<SessionRecoveryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { 
            status: response.status, 
            message: errorData.message || 'Failed to recover session' 
        };
    }

    const data = await response.json();
    
    // Zod를 이용한 런타임 검증
    const parsed = SessionRecoverySchema.safeParse(data);
    if (!parsed.success) {
        console.error('[sessionRecovery] Response validation failed:', parsed.error);
        throw new Error('Invalid server response format');
    }

    return parsed.data;
}
