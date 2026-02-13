import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useStompClient, StompResponse } from '@/shared/realtime/clients/useStompClient';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

interface SocketContextType {
    isConnected: boolean;
    request: (destination: string, bodyObj: any, timeoutMs?: number) => Promise<StompResponse>;
    send: (command: string, headers: Record<string, string>, body?: string) => boolean;
    onMessage: (callback: (msg: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function useSocket() {
    return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
    const { socketToken, refreshToken, setTokens } = useAuthStore();
    const wsUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

    // [New] Token Refresh Logic for WebSocket
    useEffect(() => {
        const checkAndRefreshToken = async () => {
            // 1. If we have a refresh token but no socket token (or connected is false), try to refresh
            if (refreshToken && !socketToken) {
                console.log("[SocketProvider] 🔄 Missing socket token. Attempting refresh...");
                try {
                    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
                    const response = await fetch(`${baseUrl}/api/auth/token/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log("[SocketProvider] ✅ Token refreshed for WebSocket.");
                        setTokens(data.accessToken, data.refreshToken, data.socketToken);
                    } else {
                        console.warn("[SocketProvider] ❌ Token refresh failed.");
                    }
                } catch (e) {
                    console.error("[SocketProvider] ⚠️ Refresh error:", e);
                }
            }
        };

        checkAndRefreshToken();
    }, [refreshToken, socketToken, setTokens]);

    const { isConnected, request, send, onMessage } = useStompClient({
        url: wsUrl,
        token: socketToken,
        enabled: !!socketToken,
    });

    return (
        <SocketContext.Provider value={{ isConnected, request, send, onMessage }}>
            {children}
        </SocketContext.Provider>
    );
}
