import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useStompClient } from '@/shared/api/websocket/useStompClient';

// TODO: .env 파일로 이동 필요
// 원격 개발 서버
// const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://i14a402.p.ssafy.io:8080/ws-server/websocket';
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

// 로컬 개발 서버
// const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws/telemetry'; // TEST: Connect to local Mock Server


interface ResponseMessage {
    correlationId?: string;
    status?: 'SUCCESS' | 'FAIL' | 'ACCEPTED' | 'REJECTED';
    message?: string;
    data?: any;
    [key: string]: any;
}

export function useTelemetrySocket(url: string = WS_URL_DEV, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const { socketToken } = useAuthStore();

    // 1. Use Shared Stomp Client
    const { isConnected, request, send, onMessage } = useStompClient({
        url,
        token: socketToken,
        enabled,
        onConnect: (sendFn) => {
            console.log("[TelemetrySocket] Session Ready. Subscribing...");
            
            // 1. Subscribe to Monitoring
            sendFn("SUBSCRIBE", {
                id: "sub-0",
                destination: "/topic/car/*/monitoring"
            });

            // 2. Subscribe to Responses
            sendFn("SUBSCRIBE", {
                id: "sub-1",
                destination: "/topic/app/responses"
            });
        }
    });

    // 2. Data Processing Logic (Specific to Map Feature)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTelemetryMessage = useCallback((parseData: any) => {
        // Handle Aircraft Data
        if (parseData.car_id || parseData.carId) {
            const aircraft: Aircraft = {
                id: parseData.car_id || parseData.carId || 'Unknown',
                callsign: parseData.car_id || parseData.carId || 'Unknown',
                
                type: 'TUG',
                position: {
                    x: parseData.x || 0,
                    y: parseData.y || 0,
                    r: (parseData.yaw || 0) * (Math.PI / 180)
                },
                status: parseData.mode || 'IDLE',
                battery: parseData.battery || 0,
                speed: parseData.v || 0,
                currentMission: parseData.currentMission,
                isLoaded: parseData.is_loaded || false
            };
            updateAircraft(aircraft);
        }
    }, [updateAircraft]);

    // 3. Register Listener
    useEffect(() => {
        const unsubscribe = onMessage(handleTelemetryMessage);
        return () => unsubscribe();
    }, [onMessage, handleTelemetryMessage]);

    return {
        isConnected,
        request,
        send
    };
}
