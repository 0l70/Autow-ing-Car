import { useEffect, useCallback, useRef } from 'react';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useSocket } from '@/shared/realtime/context/SocketProvider'; // Changed to use shared context
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { z } from 'zod';

// Basic validation schema
const AircraftStatusSchema = z.enum(['IDLE', 'MOVING_TO_GATE', 'DOCKING', 'TOWING', 'UNDOCKING', 'WAITING_FOR_RETURN', 'RETURNING', 'STOP', 'ERROR']);

const TelemetrySchema = z.object({
    car_id: z.string().optional(),
    carId: z.string().optional(),
    code: z.string().optional(), // Backend DTO uses 'code'
    
    // Backend DTO fields
    // Backend DTO fields
    posX: z.coerce.number().optional(),
    posY: z.coerce.number().optional(),
    heading: z.coerce.number().optional(),
    velocity: z.coerce.number().optional(),
    speed: z.coerce.number().optional(), // [Safety] Fallback
    status: AircraftStatusSchema.optional(),

    // Legacy/MQTT fields
    x: z.coerce.number().default(0),
    y: z.coerce.number().default(0),
    yaw: z.coerce.number().default(0),
    v: z.coerce.number().default(0),
    mode: AircraftStatusSchema.catch('IDLE'),
    
    battery: z.number().default(0),
    currentMission: z.any().optional(),
    is_loaded: z.boolean().default(false)
});

import { useAircraftStore } from '@/entities/aircraft';

export function usePilotSocket(targetCarId?: string | null, enabled: boolean = true) {
    const ingestAircraft = useAircraftStore(state => state.ingest);
    const { socketToken } = useAuthStore();
    
    // 1. Use Shared Socket Context (Singleton)
    const socket = useSocket();
    
    // Safe access to context values
    const isConnected = socket?.isConnected ?? false;
    const send = socket?.send;
    const onMessage = socket?.onMessage;

    // 2. Pilot-Specific Subscriptions
    // [REFACTORED] Global Pilot Subscriptions moved to PilotInitializer.tsx to prevent duplicates
    
    // 3. Dynamic Subscription for Car Monitoring
    useEffect(() => {
        if (isConnected && targetCarId && send) {
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
        }
    }, [isConnected, targetCarId, send]);

    // 4. Data Processing Logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTelemetryMessage = useCallback((msg: any) => {
        const { destination, body } = msg;

        if (!destination?.startsWith('/topic/towingcar/')) {
            return;
        }

        const parseData = body || msg;
        
        const result = TelemetrySchema.safeParse(parseData);
        if (!result.success) {
            console.warn("[PilotSocket] Telemetry Parse Failed:", result.error.format());
            return;
        }
        
        const data = result.data;
        const rawId = data.code || data.car_id || data.carId;
        
        const finalStatus = data.status || data.mode;
        const finalX = data.posX ?? data.x ?? 0;
        const finalY = data.posY ?? data.y ?? 0;
        const finalYaw = data.heading ?? data.yaw ?? 0;
                                                                           
        // Priority: velocity (DTO) -> v (MQTT active field) -> speed (Fallback)
        const finalV = data.velocity ?? data.v ?? data.speed ?? 0; 

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
                // [Fix] 텔레메트리 수신 시 미션 정보가 없으면 기존 정보를 유지
                ...(data.currentMission ? { currentMission: data.currentMission } : {}),
                isLoaded: data.is_loaded
            };
            ingestAircraft(aircraft);
        }

        // [DEBUG] Speed Issue Investigation
        if (rawId === targetCarId && (finalV === 0 || finalV === undefined)) {
             // console.warn(`[PilotSocket] Speed is 0 or undefined. Raw Data:`, data);
        }
  }, [ingestAircraft, targetCarId]);

    // 5. Register Listener
    useEffect(() => {
        if (!onMessage) return;
        const unsubscribe = onMessage(handleTelemetryMessage);
        return () => unsubscribe();
    }, [onMessage, handleTelemetryMessage]);

    return {
        isConnected,
        request: socket?.request,
        send,
        onMessage
    };
}
