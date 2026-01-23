import { useEffect, useRef } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

// TODO: Move to .env
// Note: Appending '/websocket' is often required when connecting to a SockJS endpoint via raw WebSocket
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://i14a402.p.ssafy.io:8080/ws-server/websocket';

export function useTelemetrySocket(url: string = WS_URL_DEV, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const { token } = useAuthStore();
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!enabled || !token) return;

        // 1. Build Secure URL (Append Token)
        // Spring Security Interceptor checks 'token' param
        const wsUrl = `${url}?token=${token}`;
        console.log(`[TelemetrySocket] Connecting to ${wsUrl}...`);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[TelemetrySocket] Connected. Sending STOMP CONNECT...");
            
            // 2. STOMP CONNECT Frame
            const connectFrame = "CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0";
            ws.send(connectFrame);
        };

        ws.onmessage = (event) => {
            try {
                const data = event.data;
                // console.log("[TelemetrySocket] Raw Data:", data);

                // 3. Handle STOMP Frames
                if (data.startsWith("CONNECTED")) {
                    console.log("[TelemetrySocket] STOMP CONNECTED. Subscribing...");
                    // Subscribe to All Cars (Wildcard)
                    const subscribeFrame = "SUBSCRIBE\nid:sub-0\ndestination:/topic/car/*/monitoring\n\n\0";
                    ws.send(subscribeFrame);
                } 
                else if (data.startsWith("MESSAGE")) {
                    // 4. Parse Body from MESSAGE Frame
                    // Structure: COMMAND \n HEADERS \n\n BODY \0
                    const bodyIndex = data.indexOf("\n\n");
                    if (bodyIndex !== -1) {
                        // Remove null terminator at the end
                        const rawBody = data.substring(bodyIndex + 2).replace(/\0$/, '');
                        if (rawBody) {
                             const parseData = JSON.parse(rawBody);
                             // console.log("[TelemetrySocket] Payload:", parseData);

                             // Map to Frontend Model
                            const aircraft: Aircraft = {
                                id: parseData.car_id || parseData.carId || 'Unknown',
                                callsign: parseData.car_id || parseData.carId || 'Unknown',
                                vehicleId: parseData.car_id || parseData.carId || 'Unknown',
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
                    }
                }
            } catch (err) {
                console.error("[TelemetrySocket] Parse Error:", err);
            }
        };

        ws.onclose = () => {
            console.log("[TelemetrySocket] Disconnected");
        };

        ws.onerror = (err) => {
             console.error("[TelemetrySocket] Error:", err);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [url, enabled, updateAircraft, token]); 
}
