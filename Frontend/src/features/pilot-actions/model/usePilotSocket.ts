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
    mode: AircraftStatusSchema.catch('IDLE'),
    battery: z.number().default(0),
    currentMission: z.any().optional(),
    is_loaded: z.boolean().default(false)
});

// TODO: .env 파일로 이동 필요
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

export function usePilotSocket(targetCarId: string, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const { socketToken } = useAuthStore();
    const serverUrl = WS_URL_DEV;

    // 1. OnConnect Callback
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log(`[PilotSocket] Session Ready. Subscribing for Car: ${targetCarId}`);
        
        // 1. Subscribe to My Car Monitoring
        sendFn("SUBSCRIBE", {
            id: `sub-pilot-monitor-${targetCarId}`,
            destination: WS_TOPICS.MONITORING(targetCarId)
        });

        // 2. Subscribe to Private Responses
        sendFn("SUBSCRIBE", {
            id: "sub-pilot-private",
            destination: WS_TOPICS.PRIVATE_RESPONSES
        });

        // 3. Subscribe to Flight Info
        sendFn("SUBSCRIBE", {
            id: "sub-pilot-flight-info",
            destination: WS_TOPICS.PILOT_FLIGHT_INFO
        });

        // 4. Request Flight Info (명시적 요청)
        console.log("[PilotSocket] Requesting flight info...");
        sendFn("SEND", {
            destination: "/app/flight/info/request"
        }, "");
    }, [targetCarId]);

    // 2. Use Shared Stomp Client
    const { isConnected, request, send, onMessage } = useStompClient({
        url: serverUrl,
        token: socketToken,
        enabled,
        onConnect: handleConnect
    });

    // 3. Data Processing Logic (Specific to Pilot - Update only my car)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTelemetryMessage = useCallback((parseData: any) => {
        const result = TelemetrySchema.safeParse(parseData);
        if (!result.success) return;
        
        const data = result.data;
        const rawId = data.car_id || data.carId;

        // 내 차 정보만 업데이트
        if (rawId && rawId === targetCarId) {
            const aircraft: Aircraft = {
                id: rawId,
                callsign: rawId,
                type: 'TUG',
                position: {
                    x: data.x,
                    y: data.y,
                    r: data.yaw * (Math.PI / 180)
                },
                status: data.mode,
                battery: data.battery,
                speed: data.v,
                currentMission: data.currentMission,
                isLoaded: data.is_loaded
            };
            updateAircraft(aircraft);
        }
    }, [updateAircraft, targetCarId]);

    // 4. Register Listener
    useEffect(() => {
        const unsubscribe = onMessage(handleTelemetryMessage);
        return () => unsubscribe();
    }, [onMessage, handleTelemetryMessage]);

    return {
        isConnected,
        request,
        send,
        onMessage
    };
}
