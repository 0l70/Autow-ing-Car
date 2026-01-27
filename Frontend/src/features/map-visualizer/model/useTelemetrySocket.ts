import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { z } from 'zod';

// Basic validation schema
const AircraftStatusSchema = z.enum(['IDLE', 'MOVING', 'DOCKING', 'HOLD', 'ERROR']);

const TelemetrySchema = z.object({
    car_id: z.string().optional(),
    carId: z.string().optional(),
    x: z.number().default(0),
    y: z.number().default(0),
    yaw: z.number().default(0),
    v: z.number().default(0),
    mode: AircraftStatusSchema.catch('IDLE'), // Fallback to IDLE if invalid
    battery: z.number().default(0),
    currentMission: z.any().optional(),
    is_loaded: z.boolean().default(false)
});

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

    // 1. OnConnect Callback
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log("[TelemetrySocket] Session Ready. Subscribing...");
        
        // 1. Subscribe to Monitoring
        sendFn("SUBSCRIBE", {
            id: "sub-0",
            destination: WS_TOPICS.MONITORING('*')
        });

        // 2. Subscribe to Responses
        sendFn("SUBSCRIBE", {
            id: "sub-1",
            destination: WS_TOPICS.APP_RESPONSES
        });
    }, []);

    // 2. Use Shared Stomp Client
    const { isConnected, request, send, onMessage } = useStompClient({
        url,
        token: socketToken,
        enabled,
        onConnect: handleConnect
    });

    // 2. Data Processing Logic (Specific to Map Feature)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTelemetryMessage = useCallback((parseData: any) => {
        const result = TelemetrySchema.safeParse(parseData);
        if (!result.success) {
            // console.warn("Invalid Telemetry Data:", result.error);
            return;
        }
        
        const data = result.data;
        const rawId = data.car_id || data.carId;

        if (rawId) {
            const aircraft: Aircraft = {
                id: rawId,
                callsign: rawId, // using ID as callsign for now
                type: 'TUG',
                position: {
                    x: data.x,
                    y: data.y,
                    r: data.yaw * (Math.PI / 180)
                },
                status: data.mode, // Now strictly typed as AircraftStatus
                battery: data.battery,
                speed: data.v,
                currentMission: data.currentMission,
                isLoaded: data.is_loaded
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
