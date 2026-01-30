import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { useSocket } from '@/shared/realtime/context/SocketProvider';
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

// Use Env Var with Fallback
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket';

export function useTelemetrySocket(url: string = WS_URL_DEV, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const { socketToken } = useAuthStore();
    
    // 1. Try to consume Context
    const context = useSocket();

    // 2. Fallback Client (Only enabled if Context is missing AND hook is enabled)
    // This ensures backward compatibility if Provider is missing.
    const shouldFallback = !context;
    
    const handleConnect = useCallback(() => {
        // Only run this if using Fallback Client (Context subscribers handle their own logic)
        // With Context, the global connection might already be open.
    }, []);

    const fallbackClient = useStompClient({
        url,
        token: socketToken,
        enabled: shouldFallback && enabled,
        onConnect: handleConnect
    });

    // 3. Select Active Client
    const client = context || fallbackClient;
    const { isConnected, request, send, onMessage } = client;

    // 4. Subscription Logic (Runs for BOTH Context and Fallback)
    useEffect(() => {
        if (isConnected && enabled) {
            console.log("[TelemetrySocket] Subscribing to Monitoring...");
            
            // Subscribe to Monitoring
            send("SUBSCRIBE", {
                id: "sub-monitoring-all",
                destination: WS_TOPICS.MONITORING('*')
            });

            // Subscribe to Responses
            send("SUBSCRIBE", {
                id: "sub-app-responses",
                destination: WS_TOPICS.APP_RESPONSES
            });

            // [ATC] Subscribe to Mission Updates (New)
            send("SUBSCRIBE", {
                id: "sub-mission-updates",
                destination: WS_TOPICS.MISSION_UPDATES
            });
        }
    }, [isConnected, enabled, send]);

    // 5. Data Processing Logic
    const handleTelemetryMessage = useCallback((msg: any) => {
        const { destination, body: parseData } = msg;

        // A. Check for Mission Update
        if (destination === WS_TOPICS.MISSION_UPDATES) {
             if (parseData.missionId && parseData.towingCarCode) {
                console.log("[Socket] Mission Update:", parseData);
                useGraphStore.getState().updateMission(parseData);
            }
            return;
        }

        // B. Check for Telemetry (Movement) - Match /topic/towingcar/*
        if (destination?.startsWith('/topic/towingcar/')) {
            const result = TelemetrySchema.safeParse(parseData);
            if (!result.success) return;
            
            const data = result.data;
            const rawId = data.car_id || data.carId;

            if (rawId) {
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
        }
    }, [updateAircraft]);

    // 6. Register Listener
    useEffect(() => {
        const unsubscribe = onMessage(handleTelemetryMessage);
        return () => unsubscribe();
    }, [onMessage, handleTelemetryMessage]);

    // 7. Mock Traffic Simulation (Legacy Frontend Mock - Removed in favor of Backend MQTT)
    // No-op

    return {
        isConnected,
        request,
        send,
        onMessage
    };
}
