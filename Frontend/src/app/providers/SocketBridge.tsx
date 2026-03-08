import { useEffect, useCallback, useRef } from "react";
import { useSocket, WS_TOPICS } from "@/shared/realtime";
import { useAircraftStore } from "@/entities/aircraft";
import { useMissionStore } from "@/entities/mission";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { MapInfoPayloadSchema } from "@/shared/realtime/api/map.schema";
import { z } from "zod";

import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { useSyncStore } from "@/shared/model/syncStore";
import { mapApi } from "@/entities/map/api/mapApi";
import { missionApi } from "@/entities/mission/api/missionApi";
import { towingCarApi } from "@/entities/aircraft/api/towingCarApi";
import { flightApi } from "@/entities/mission/api/flightApi";

const TelemetrySchema = z.object({
  car_id: z.string().optional(),
  carId: z.string().optional(),
  code: z.string().optional(),
  
  // Frontend/MQTT standard
  x: z.number().default(0),
  y: z.number().default(0),
  yaw: z.number().default(0),
  v: z.number().default(0),
  
  // Backend DTO standard (Incoming Payload)
  posX: z.number().optional(),
  posY: z.number().optional(),
  heading: z.number().optional(),
  velocity: z.number().optional(),

  status: z.string().optional(),
  mode: z.string().optional(),
  battery: z.number().default(0),
  currentMission: z.any().optional(),
  is_loaded: z.boolean().default(false),
});

export function SocketBridge() {
  const socket = useSocket();

  // Entity Stores
  const ingestAircraft = useAircraftStore((state) => state.ingest);
  const setAllAircrafts = useAircraftStore((state) => state.setAllAircrafts);
  const ingestMission = useMissionStore((state) => state.ingest);
  const setAllMissions = useMissionStore((state) => state.setAllMissions);
  const { loadGraph, setCorners, setMapDimensions, setMapMeta } =
    useGraphStore();

  // Sync Store
  const {
    isInitialSyncComplete,
    setMapLoaded,
    setMissionLoaded,
    setAircraftLoaded,
    setSyncComplete,
  } = useSyncStore();

  // Message Buffer
  const messageBuffer = useRef<any[]>([]);

  // 1. Unified Message Handler
  const handleMessage = useCallback(
    (msg: any) => {
      // [DEBUG] Check Entry Point
      // console.log(`[SocketBridge] 📨 Msg Received from ${msg.destination}. SyncComplete: ${isInitialSyncComplete}`);

      // [Buffering Logic] If sync not complete, push to buffer
      if (!isInitialSyncComplete) {
        // console.warn("[SocketBridge] ⏳ Buffering (Sync Incomplete)...");
        messageBuffer.current.push(msg);
        return;
      }

      processRealtimeMessage(msg);
    },
    [isInitialSyncComplete],
  );

  // 2. Realtime Message Processor
  const processRealtimeMessage = useCallback(
    (msg: any) => {
      const { destination, body } = msg;

      // 2.1. Mission Updates
      if (destination === WS_TOPICS.MISSION_UPDATES) {
        if (body.towingCarCode) {
          ingestMission(body.towingCarCode, {
            flightNumber: body.flightNumber,
            destNode: body.destNode,
            status: body.status,
            departNode: body.departNode,
            edgeIds: body.edgeIds, // 보강: 경로 정보 포함
          });
        }
        return;
      }

      // 2.2. Map Info Updates (Graph)
      if (destination === WS_TOPICS.MAP_INFO) {
        const result = MapInfoPayloadSchema.safeParse(body);
        if (result.success) {
          const data = result.data;
          if (data.width && data.height)
            setMapDimensions(data.width, data.height);
          if (data.corners) setCorners(data.corners);
          const adaptedEdges = (data.edges || []).map((e: any) => ({
            ...e,
            fromId: e.from,
            toId: e.to,
            waypoints: e.waypoints || [],
          }));
          loadGraph(data.nodes as any, adaptedEdges as any);
        }
        return;
      }

      // 2.3. Telemetry Updates
      if (destination?.startsWith("/topic/towingcar/")) {
        const result = TelemetrySchema.safeParse(body);
        if (!result.success) return;

        const data = result.data;
        const rawId = data.car_id || data.carId || data.code;
        
        // [Fix] Map Backend fields (posX, posY...) to Internal fields
        const finalX = data.posX ?? data.x;
        const finalY = data.posY ?? data.y;
        const finalYaw = data.heading ?? data.yaw;
        const finalV = data.velocity ?? data.v;
        if (rawId) {
            // [Conversion]
            // Input: finalYaw is Radians (from Backend/MQTT)
            // Output: r -> Degrees (0-360) for UI & Store
            const degrees = finalYaw * (180 / Math.PI);
            const normalizedHeading = (degrees % 360 + 360) % 360; 

            const aircraft: Aircraft = {
              id: rawId,
              callsign: rawId,
              type: "TUG",
              position: {
                x: finalX,
                y: finalY,
                r: normalizedHeading, // [Changed] Stored as Degrees
              },
              status: (data.status || data.mode || "IDLE") as any,
              battery: data.battery,
              speed: finalV,
              // [Fix] 텔레메트리에 미션 정보가 없을 경우 기존 정보를 유지하도록 store의 병합 기능 활용
              // 여기서는 Aircraft 객체를 만들어 ingest에 전달하므로, 
              // 페이로드에 정보가 있을 때만 포함시킵니다.
              ...(data.currentMission ? { currentMission: data.currentMission } : {}),
              isLoaded: data.is_loaded,
            };
          ingestAircraft(aircraft);
        }
      }

      if (destination === WS_TOPICS.APP_RESPONSES) {
        console.log("[SocketBridge] App Response:", body);
        return;
      }
    },
    [ingestAircraft, ingestMission, loadGraph, setCorners, setMapDimensions],
  );

  // 3. Initial Data Sync Orchestration
  const { user } = useAuthStore(); // Added to check role
  const setPilotInfoLoaded = useSyncStore((state) => state.setPilotInfoLoaded);

  useEffect(() => {
    const syncInitialData = async () => {
      try {
        console.log("[SocketBridge] 🚀 Starting Parallel Data Sync...");

        const isPilot = user?.role === "PILOT";

        // Fetch All Core Data in Parallel (Including Pilot info if applicable)
        const [mapData, missionData, aircraftData, pilotData] =
          await Promise.all([
            mapApi.getMapInfo(),
            missionApi.getActiveMissions().catch(() => ({})),
            towingCarApi.getAllTowingCars().catch(() => []),
            isPilot
              ? flightApi.getFlightInfo().catch(() => null)
              : Promise.resolve(null),
          ]);

        // 3.1. Load Map
        if (mapData) {
          console.log("[debug] Raw Map Nodes from API:", mapData.nodes);
          setMapDimensions(mapData.width, mapData.height);
          setMapMeta({
            image: mapData.imagePath || "my_map.pgm",
            resolution: mapData.resolution || 0.05,
            origin: [mapData.originX || 0, mapData.originY || 0, 0],
            mode: "trinary",
            negate: false,
            occupied_thresh: 0.65,
            free_thresh: 0.25,
          });
          if (mapData.corners) setCorners(mapData.corners);
          const adaptedEdges = (mapData.edges || []).map((e: any) => ({
            ...e,
            fromId: e.from,
            toId: e.to,
            waypoints: e.waypoints || [],
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
          useMissionStore.getState().setFlightInfo(pilotData);
          setPilotInfoLoaded(true);
        }

        console.log("[SocketBridge] ✅ REST Synchronization Complete.");

        // 3.5. Flush Buffer
        if (messageBuffer.current.length > 0) {
          console.log(
            `[SocketBridge] 🔄 Flushing ${messageBuffer.current.length} buffered messages...`,
          );
          messageBuffer.current.forEach((msg) => processRealtimeMessage(msg));
          messageBuffer.current = [];
        }

        // 3.6. Mark Sync Complete
        setSyncComplete(true);
      } catch (err) {
        console.error("[SocketBridge] ❌ Synchronization Failed:", err);
      }
    };

    syncInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. WebSocket Subscription Management
  // 4. WebSocket Subscription Management
  
  // 4.1. Message Listener Registration (Depends on handleMessage)
  useEffect(() => {
    if (!socket) return;
    // Register listener
    const unsubscribe = socket.onMessage(handleMessage);
    
    // Cleanup listener on unmount or when handleMessage changes
    return () => {
      unsubscribe();
    };
  }, [socket, handleMessage]);

  // 4.2. Topic Subscriptions (Depends only on connection status)
  useEffect(() => {
    if (!socket || !socket.isConnected) return;

    console.log("[SocketBridge] 📡 Subscribing to topics...");

    // Pilot already subscribes to individual car via usePilotSocket, skip wildcard
    const isPilot = user?.role === "PILOT";
    if (!isPilot) {
      socket.send("SUBSCRIBE", {
        id: "sub-monitoring-all",
        destination: WS_TOPICS.MONITORING("*"),
      });
    }

    socket.send("SUBSCRIBE", {
      id: "sub-mission-updates",
      destination: WS_TOPICS.MISSION_UPDATES,
    });
    socket.send("SUBSCRIBE", {
      id: "sub-map-info-global",
      destination: WS_TOPICS.MAP_INFO,
    });
    socket.send("SUBSCRIBE", {
      id: "sub-app-responses-global",
      destination: WS_TOPICS.APP_RESPONSES,
    });
    socket.send("SUBSCRIBE", {
      id: "sub-controller-requests",
      destination: WS_TOPICS.CONTROLLER_REQUESTS,
    });

    return () => {
      console.log("[SocketBridge] 🔌 Cleaning up subscriptions...");
      // Ideally, we should send UNSUBSCRIBE frames here if we want to be strict,
      // but usually closing the socket or page reload handles it.
      // Since this effect only runs on mount/connection change, it's safer.
    };
  }, [socket, socket?.isConnected, user?.role]);

  return null;
}
