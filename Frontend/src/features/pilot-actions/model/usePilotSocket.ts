import { useEffect, useCallback } from 'react';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { z } from 'zod';

// Basic validation schema
const AircraftStatusSchema = z.enum(['IDLE', 'MOVING_TO_GATE', 'DOCKING', 'TOWING', 'UNDOCKING', 'WAITING_FOR_RETURN', 'RETURNING', 'STOP', 'ERROR']);

const TelemetrySchema = z.object({
    car_id: z.string().optional(),
    carId: z.string().optional(),
    code: z.string().optional(), // Backend DTO uses 'code'
    
    // Backend DTO fields
    posX: z.number().optional(),
    posY: z.number().optional(),
    heading: z.number().optional(),
    velocity: z.number().optional(),
    speed: z.number().optional(), // [Safety] Fallback
    status: AircraftStatusSchema.optional(),

    // Legacy/MQTT fields
    x: z.number().default(0),
    y: z.number().default(0),
    yaw: z.number().default(0),
    v: z.number().default(0),
    mode: AircraftStatusSchema.catch('IDLE'),
    
    battery: z.number().default(0),
    currentMission: z.any().optional(),
    is_loaded: z.boolean().default(false)
});

// ... (omitted)

    const handleTelemetryMessage = useCallback((msg: any) => {
        // ... (omitted)
        
        const finalStatus = data.status || data.mode;
        const finalX = data.posX ?? data.x;
        const finalY = data.posY ?? data.y;
        const finalYaw = data.heading ?? data.yaw;
        // Priority: velocity (DTO) -> speed (Common) -> v (Legacy)
        const finalV = data.velocity ?? data.speed ?? data.v; 

        // 내 차 정보만 업데이트
        if (rawId && rawId === targetCarId) {
             // ...
             // [DEBUG] Log specifically if speed is 0 but car is moving state (optional)
        }
});

// TODO: .env 파일로 이동 필요
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

import { useAircraftStore } from '@/entities/aircraft';

export function usePilotSocket(targetCarId?: string | null, enabled: boolean = true) {
    const ingestAircraft = useAircraftStore(state => state.ingest);
    const { socketToken } = useAuthStore();
    const serverUrl = WS_URL_DEV;

    // 1. OnConnect Callback
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log(`[PilotSocket] Session Ready. Account: ${socketToken?.substring(0, 8)}...`);
        
        // 1. Subscribe to Private Responses
        sendFn("SUBSCRIBE", {
            id: "sub-pilot-private",
            destination: WS_TOPICS.PRIVATE_RESPONSES
        });

        // 2. Subscribe to Flight Info
        sendFn("SUBSCRIBE", {
            id: "sub-pilot-flight-info",
            destination: WS_TOPICS.PILOT_FLIGHT_INFO
        });

        // 3. Request Flight Info (명시적 요청)
        console.log("[PilotSocket] Requesting flight info...");
        sendFn("SEND", {
            destination: "/app/flight/info/request"
        }, "");
    }, [socketToken]);

    // 2. Use Shared Stomp Client
    const { isConnected, request, send, onMessage } = useStompClient({
        url: serverUrl,
        token: socketToken,
        enabled,
        onConnect: handleConnect
    });

    // 2.1 Dynamic Subscription for Car Monitoring
    // This allows subscription even if car ID is assigned AFTER the socket connects.
    useEffect(() => {
        if (isConnected && targetCarId) {
            const subId = `sub-pilot-monitor-${targetCarId}`;
            console.log(`[PilotSocket] 🎯 Subscribing to car telemetry: ${targetCarId}`);
            
            send("SUBSCRIBE", {
                id: subId,
                destination: WS_TOPICS.MONITORING(targetCarId)
            });

            return () => {
                console.log(`[PilotSocket] Unsubscribing from car telemetry: ${targetCarId}`);
                send("UNSUBSCRIBE", { id: subId });
            };
        } else {
             // console.log(`[PilotSocket] ⚠️ Subscription Skipped - Connected: ${isConnected}, TargetCar: ${targetCarId}`);
        }
    }, [isConnected, targetCarId, send]);

    // 3. Data Processing Logic (Specific to Pilot - Update only my car)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTelemetryMessage = useCallback((msg: any) => {
        const { destination, body } = msg;

        // [RESTORED] Strict filtering: Only process telemetry topics
        if (!destination?.startsWith('/topic/towingcar/')) {
            return;
        }

        const parseData = body || msg; // Unwrap Stomp Message Wrapper
        
        const result = TelemetrySchema.safeParse(parseData);
        if (!result.success) {
            console.warn("[PilotSocket] Telemetry Parse Failed:", result.error.format());
            return;
        }
        
        const data = result.data;
        // Backend DTO uses 'code', MQTT uses 'carId' or 'car_id'
        const rawId = data.code || data.car_id || data.carId;
        
        // Priority: DTO fields -> MQTT fields -> Default
        const finalStatus = data.status || data.mode;
        const finalX = data.posX ?? data.x;
        const finalY = data.posY ?? data.y;
        const finalYaw = data.heading ?? data.yaw;
        const finalV = data.velocity ?? data.v;

        // 내 차 정보만 업데이트
        if (rawId && rawId === targetCarId) {
            const aircraft: Aircraft = {
                id: rawId,
                callsign: rawId,
                type: 'TUG',
                position: {
                    x: finalX,
                    y: finalY,
                    r: finalYaw * (Math.PI / 180)
                },
                status: finalStatus as any,
                battery: data.battery,
                speed: finalV,
                currentMission: data.currentMission,
                isLoaded: data.is_loaded
            };
            ingestAircraft(aircraft);
        } else if (rawId) {
            // console.log(`[PilotSocket] Ignoring telemetry for ${rawId} (Target: ${targetCarId})`);
        }

        // [DEBUG] Speed Issue Investigation
        if (rawId === targetCarId && (finalV === 0 || finalV === undefined)) {
             // console.warn(`[PilotSocket] Speed is 0 or undefined. Raw Data:`, data);
        }
  }, [ingestAircraft, targetCarId]);

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
