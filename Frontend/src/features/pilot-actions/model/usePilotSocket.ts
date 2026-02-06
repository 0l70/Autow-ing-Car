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
        const finalX = data.posX ?? data.x;
        const finalY = data.posY ?? data.y;
        const finalYaw = data.heading ?? data.yaw;
                                                                           
        // Priority: velocity (DTO) -> speed (Common) -> v (Legacy)
        const finalV = data.velocity ?? data.speed ?? data.v; 

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
