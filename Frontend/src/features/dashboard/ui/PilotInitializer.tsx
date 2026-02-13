import { useEffect, ReactNode } from 'react';
import { useSocket, WS_TOPICS } from '@/shared/realtime';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

interface PilotInitializerProps {
    children: ReactNode;
}

/**
 * PilotInitializer
 * 기장(PILOT) 권한인 경우에만 동작하며,
 * 전역적인 파일럿 소켓 구독 및 비행 정보 요청을 담당합니다.
 * (기존 usePilotSocket에서 분리됨)
 */
export function PilotInitializer({ children }: PilotInitializerProps) {
    const socket = useSocket();
    const { socketToken } = useAuthStore();
    const isConnected = socket?.isConnected;
    const send = socket?.send;

    useEffect(() => {
        if (!isConnected || !send || !socketToken) return;

        console.log("[PilotInitializer] 🚀 Starting Global Pilot Session...");

        // 1. Subscribe to Private Responses
        send("SUBSCRIBE", {
            id: "sub-pilot-private",
            destination: WS_TOPICS.PRIVATE_RESPONSES
        });

        // 2. Subscribe to Flight Info
        send("SUBSCRIBE", {
            id: "sub-pilot-flight-info",
            destination: WS_TOPICS.PILOT_FLIGHT_INFO
        });

        // 3. Subscribe to Mission Updates (Global broadcast for path data)
        send("SUBSCRIBE", {
            id: "sub-pilot-mission-updates",
            destination: WS_TOPICS.MISSION_UPDATES
        });

        // 4. Request Flight Info (Explicit Request)
        console.log("[PilotInitializer] 📨 Requesting flight info...");
        send("SEND", {
            destination: "/app/flight/info/request"
        }, "");

        return () => {
            console.log("[PilotInitializer] 🔌 Cleaning up Global Pilot Session...");
            send("UNSUBSCRIBE", { id: "sub-pilot-private" });
            send("UNSUBSCRIBE", { id: "sub-pilot-flight-info" });
            send("UNSUBSCRIBE", { id: "sub-pilot-mission-updates" });
        };
    }, [isConnected, send, socketToken]);

    return <>{children}</>;
}

