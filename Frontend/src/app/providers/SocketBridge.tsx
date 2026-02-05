import { useEffect, useCallback, useRef } from 'react';
import { useSocket, WS_TOPICS } from '@/shared/realtime';
import { useAircraftStore } from '@/entities/aircraft';
import { useMissionStore } from '@/entities/mission';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { MapInfoPayloadSchema } from '@/shared/realtime/api/map.schema';
import { z } from 'zod';

import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useSyncStore } from '@/shared/model/syncStore';
import { mapApi } from '@/entities/map/api/mapApi';
import { missionApi } from '@/entities/mission/api/missionApi';
import { towingCarApi } from '@/entities/aircraft/api/towingCarApi';
import { flightApi } from '@/entities/mission/api/flightApi';


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
    
    // Entity Stores
    const ingestAircraft = useAircraftStore(state => state.ingest);
    const setAllAircrafts = useAircraftStore(state => state.setAllAircrafts);
    const ingestMission = useMissionStore(state => state.ingest);
    const setAllMissions = useMissionStore(state => state.setAllMissions);
    const { loadGraph, setCorners, setMapDimensions, setMapMeta } = useGraphStore();

    // Sync Store
    const { 
        isInitialSyncComplete, 
        setMapLoaded, 
        setMissionLoaded, 
        setAircraftLoaded, 
        setSyncComplete 
    } = useSyncStore();

    // Message Buffer
    const messageBuffer = useRef<any[]>([]);

    // 1. Unified Message Handler
    const handleMessage = useCallback((msg: any) => {
        // [Buffering Logic] If sync not complete, push to buffer
        if (!isInitialSyncComplete) {
            console.log("[SocketBridge] 📥 Buffering message during sync:", msg.destination);
            messageBuffer.current.push(msg);
            return;
        }

        processRealtimeMessage(msg);
    }, [isInitialSyncComplete]);

    // 2. Realtime Message Processor
    const processRealtimeMessage = useCallback((msg: any) => {
        const { destination, body } = msg;

        // 2.1. Mission Updates
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

        // 2.2. Map Info Updates (Graph)
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

        // 2.3. Telemetry Updates
        if (destination?.startsWith('/topic/towingcar/')) {
            const result = TelemetrySchema.safeParse(body);
            if (!result.success) return;
            
            const data = result.data;
            const rawId = data.car_id || data.carId || data.code;

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

        if (destination === WS_TOPICS.APP_RESPONSES) {
            console.log("[SocketBridge] App Response:", body);
            return;
        }
    }, [ingestAircraft, ingestMission, loadGraph, setCorners, setMapDimensions]);

    // 3. Initial Data Sync Orchestration
    const { user } = useAuthStore(); // Added to check role
    const setPilotInfoLoaded = useSyncStore(state => state.setPilotInfoLoaded);

    useEffect(() => {
        const syncInitialData = async () => {
            try {
                console.log("[SocketBridge] 🚀 Starting Parallel Data Sync...");
                
                const isPilot = user?.role === 'PILOT';

                // Fetch All Core Data in Parallel (Including Pilot info if applicable)
                const [mapData, missionData, aircraftData, pilotData] = await Promise.all([
                    mapApi.getMapInfo(),
                    missionApi.getActiveMissions().catch(() => ({})),
                    towingCarApi.getAllTowingCars().catch(() => []),
                    isPilot ? flightApi.getFlightInfo().catch(() => null) : Promise.resolve(null)
                ]);

                // 3.1. Load Map
                if (mapData) {
                    setMapDimensions(mapData.width, mapData.height);
                    setMapMeta({
                        image: mapData.imagePath || "my_map.pgm",
                        resolution: mapData.resolution || 0.05,
                        origin: [mapData.originX || 0, mapData.originY || 0, 0],
                        mode: 'trinary',
                        negate: false,
                        occupied_thresh: 0.65,
                        free_thresh: 0.25
                    });
                    if (mapData.corners) setCorners(mapData.corners);
                    const adaptedEdges = (mapData.edges || []).map((e: any) => ({
                        ...e,
                        fromId: e.from,
                        toId: e.to,
                        waypoints: e.waypoints || []
                    }));
                    loadGraph(mapData.nodes as any, adaptedEdges as any);
                    setMapLoaded(true);
                }

                // 3.2. Load Missions
                setAllMissions(missionData);
                setMissionLoaded(true);

                // 3.3. Load Aircrafts
                setAllAircrafts(aircraftData);
                setAircraftLoaded(true);

                // 3.4. Load Pilot Info if applicable
                if (isPilot && pilotData) {
                    // Note: Here we update Pilot-specific store or state if needed
                    // For now, we just mark it as loaded for the gate.
                    setPilotInfoLoaded(true);
                }

                console.log("[SocketBridge] ✅ REST Synchronization Complete.");
                
                // 3.5. Flush Buffer
                if (messageBuffer.current.length > 0) {
                    console.log(`[SocketBridge] 🔄 Flushing ${messageBuffer.current.length} buffered messages...`);
                    messageBuffer.current.forEach(msg => processRealtimeMessage(msg));
                    messageBuffer.current = [];
                }

                // 3.6. Mark Sync Complete
                setSyncComplete(true);
                
            } catch (err) {
                console.error("[SocketBridge] ❌ Synchronization Failed:", err);
            }
        };

        syncInitialData();
    }, [
        user, loadGraph, setCorners, setMapDimensions, setMapMeta, 
        setAllMissions, setAllAircrafts, 
        setMapLoaded, setMissionLoaded, setAircraftLoaded, setPilotInfoLoaded, setSyncComplete,
        processRealtimeMessage
    ]);


    // 4. WebSocket Subscription Management
    useEffect(() => {
        if (!socket) return;
        const unsubscribe = socket.onMessage(handleMessage);
        
        if (socket.isConnected) {
            console.log("[SocketBridge] 📡 Subscribing to topics...");
            socket.send("SUBSCRIBE", { id: "sub-monitoring-all", destination: WS_TOPICS.MONITORING('*') });
            socket.send("SUBSCRIBE", { id: "sub-mission-updates", destination: WS_TOPICS.MISSION_UPDATES });
            socket.send("SUBSCRIBE", { id: "sub-map-info-global", destination: WS_TOPICS.MAP_INFO });
            socket.send("SUBSCRIBE", { id: "sub-app-responses-global", destination: WS_TOPICS.APP_RESPONSES });
            socket.send("SUBSCRIBE", { id: "sub-controller-requests", destination: WS_TOPICS.CONTROLLER_REQUESTS });
        }

        return () => {
            console.log("[SocketBridge] 🔌 Cleaning up subscriptions...");
            unsubscribe();
        };
    }, [socket, handleMessage]);

    return null;
}

