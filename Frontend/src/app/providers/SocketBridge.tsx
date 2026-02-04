import { useEffect, useCallback } from 'react';
import { useSocket, WS_TOPICS } from '@/shared/realtime';
import { useAircraftStore } from '@/entities/aircraft';
import { useMissionStore } from '@/entities/mission';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { MapInfoPayloadSchema } from '@/shared/realtime/api/map.schema';
import { z } from 'zod';

const TelemetrySchema = z.object({
    car_id: z.string().optional(),
    carId: z.string().optional(),
    code: z.string().optional(),
    x: z.number().default(0),
    y: z.number().default(0),
    yaw: z.number().default(0),
    v: z.number().default(0),
    status: z.string().optional(),
    mode: z.string().optional(),
    battery: z.number().default(0),
    currentMission: z.any().optional(),
    is_loaded: z.boolean().default(false)
});

export function SocketBridge() {
    const socket = useSocket();
    const ingestAircraft = useAircraftStore(state => state.ingest);
    const ingestMission = useMissionStore(state => state.ingest);
    const { loadGraph, setCorners, setMapDimensions, setMapMeta } = useGraphStore();

    const handleMessage = useCallback((msg: any) => {
        const { destination, body } = msg;

        // 1. Mission Updates
        if (destination === WS_TOPICS.MISSION_UPDATES) {
            if (body.towingCarCode) {
                ingestMission(body.towingCarCode, {
                    flightNumber: body.flightNumber,
                    destNode: body.destNode,
                    status: body.status,
                    departNode: body.departNode
                });
            }
            return;
        }

        // 2. Map Info Updates (Graph)
        if (destination === WS_TOPICS.MAP_INFO) {
            const result = MapInfoPayloadSchema.safeParse(body);
            if (result.success) {
                const data = result.data;
                if (data.width && data.height) setMapDimensions(data.width, data.height);
                if (data.corners) setCorners(data.corners);
                const adaptedEdges = (data.edges || []).map((e: any) => ({
                    ...e,
                    fromId: e.from,
                    toId: e.to,
                    waypoints: e.waypoints || []
                }));
                loadGraph(data.nodes as any, adaptedEdges as any);
            }
            return;
        }

        // 3. Telemetry Updates
        if (destination?.startsWith('/topic/towingcar/')) {
            const result = TelemetrySchema.safeParse(body);
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
                    status: (data.status || data.mode || 'IDLE') as any,
                    battery: data.battery,
                    speed: data.v,
                    currentMission: data.currentMission,
                    isLoaded: data.is_loaded
                };
                ingestAircraft(aircraft);
            }
        }

        // 4. App Responses (Logging/Alerts)
        if (destination === WS_TOPICS.APP_RESPONSES) {
            console.log("[SocketBridge] App Response:", body);
            return;
        }
    }, [ingestAircraft, ingestMission, loadGraph, setCorners, setMapDimensions]);

    // Initial Map Data Fetch (HTTP)
    useEffect(() => {
        const fetchInitialMap = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
                const response = await fetch(`${baseUrl}/api/map/info`);
                if (!response.ok) return;
                const body = await response.json();
                const result = MapInfoPayloadSchema.safeParse(body);
                if (result.success) {
                    const data = result.data;
                    if (data.width && data.height) setMapDimensions(data.width, data.height);
                    
                    // [Fix] Also set MapMeta so GraphLayer can render
                    setMapMeta({
                        image: data.imagePath || "my_map.pgm",
                        resolution: data.resolution || 0.05,
                        origin: [data.originX || 0, data.originY || 0, 0],
                        mode: 'trinary',
                        negate: false,
                        occupied_thresh: 0.65,
                        free_thresh: 0.25
                    });

                    if (data.corners) setCorners(data.corners);
                    const adaptedEdges = (data.edges || []).map((e: any) => ({
                        ...e,
                        fromId: e.from,
                        toId: e.to,
                        waypoints: e.waypoints || []
                    }));
                    loadGraph(data.nodes as any, adaptedEdges as any);
                }
            } catch (err) {
                console.warn("[SocketBridge] Initial Map Fetch Failed", err);
            }
        };
        fetchInitialMap();
    }, [loadGraph, setCorners, setMapDimensions]);

    useEffect(() => {
        if (!socket) return;
        const unsubscribe = socket.onMessage(handleMessage);
        
        if (socket.isConnected) {
            socket.send("SUBSCRIBE", { id: "sub-monitoring-all", destination: WS_TOPICS.MONITORING('*') });
            socket.send("SUBSCRIBE", { id: "sub-mission-updates", destination: WS_TOPICS.MISSION_UPDATES });
            socket.send("SUBSCRIBE", { id: "sub-map-info-global", destination: WS_TOPICS.MAP_INFO });
            socket.send("SUBSCRIBE", { id: "sub-app-responses-global", destination: WS_TOPICS.APP_RESPONSES });
            socket.send("SUBSCRIBE", { id: "sub-controller-requests", destination: WS_TOPICS.CONTROLLER_REQUESTS });
        }

        return () => unsubscribe();
    }, [socket, handleMessage]);

    return null;
}
