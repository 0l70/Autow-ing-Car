import { useEffect, useRef } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';

// TODO: Move to .env
const WS_URL_DEV = 'ws://localhost:8080/ws/telemetry'; // Default Dev URL

export function useTelemetrySocket(url: string = WS_URL_DEV, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!enabled) return;

        console.log(`[TelemetrySocket] Connecting to ${url}...`);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[TelemetrySocket] Connected");
        };

        ws.onmessage = (event) => {
            try {
                // Parse Incoming JSON
                const data = JSON.parse(event.data);
                console.log("[TelemetrySocket] Received:", data); // DEBUG LOG
                
                // Assuming Backend sends raw MQTT JSON payload
                // Mapping: MQTT -> Frontend Aircraft Model
                const aircraft: Aircraft = {
                    id: data.carId,
                    callsign: data.carId, // or specific callsign field
                    vehicleId: data.carId, // Keep compatibility if needed, though we moved to 'id'
                    type: 'TUG', // Default type
                    position: {
                        x: data.x_m,
                        y: data.y_m,
                        r: (data.yaw_deg || 0) * (Math.PI / 180) // Degree to Radian
                    },
                    status: data.mode || 'IDLE',
                    battery: data.battery_pct || 0,
                    speed: data.velocity_mps || 0,
                    currentMission: data.currentMission,
                    isLoaded: data.is_loaded || false
                };

                updateAircraft(aircraft);
                
            } catch (err) {
                console.error("[TelemetrySocket] Parse Error:", err);
            }
        };

        ws.onclose = () => {
            console.log("[TelemetrySocket] Disconnected");
            // Optional: Implement Auto-Reconnect logic here
        };

        ws.onerror = (err) => {
             console.error("[TelemetrySocket] Error:", err);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [url, enabled, updateAircraft]);
}
