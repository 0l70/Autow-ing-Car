import { createContext, useContext, ReactNode } from 'react';
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
    const { socketToken } = useAuthStore();
    const wsUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

    const { isConnected, request, send, onMessage } = useStompClient({
        url: wsUrl,
        token: socketToken,
        enabled: !!socketToken, // Only connect if we have a token
    });

    return (
        <SocketContext.Provider value={{ isConnected, request, send, onMessage }}>
            {children}
        </SocketContext.Provider>
    );
}
