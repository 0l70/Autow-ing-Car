import { useAuthStore } from '@/features/auth/model/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
}

export const apiClient = {
    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { accessToken, refreshToken, setTokens, logout } = useAuthStore.getState();
        
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        if (options.params) {
            Object.keys(options.params).forEach(key => {
                const val = options.params![key];
                if (val !== undefined) url.searchParams.append(key, val);
            });
        }

        const headers = new Headers(options.headers);
        if (accessToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${accessToken}`);
        }
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        let response = await fetch(url.toString(), {
            ...options,
            headers
        });

        // 1. 401 Unauthorized 발생 시 토큰 리프레시 시도
        if (response.status === 401 && refreshToken) {
            console.warn('[apiClient] 401 Unauthorized detect. Attempting token refresh...');
            
            try {
                const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/token/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    // AuthDtos.TokenResponse: { accessToken, refreshToken, socketToken, ... }
                    console.log('[apiClient] Token refresh success.');
                    setTokens(data.accessToken, data.refreshToken, data.socketToken);
                    
                    // 2. 새로운 액세스 토큰으로 원래 요청 재시도
                    headers.set('Authorization', `Bearer ${data.accessToken}`);
                    response = await fetch(url.toString(), {
                        ...options,
                        headers
                    });
                } else {
                    // 리프레시 토큰도 만료된 경우
                    console.error('[apiClient] Refresh token expired. Logging out.');
                    logout();
                    throw new Error('Session expired');
                }
            } catch (error) {
                console.error('[apiClient] Token refresh failed:', error);
                logout();
                throw error;
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        return response.json();
    }
};
