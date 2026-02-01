import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { useSocket } from '@/shared/realtime/context/SocketProvider';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { MapInfoPayloadSchema } from '@/shared/realtime/api/map.schema';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

export function useMapSync(enabled: boolean = true) {
    const { loadGraph, setCorners } = useGraphStore();
    const { socketToken } = useAuthStore();

    // 1. Try to consume Context
    const context = useSocket();

    // 2. Fallback Client (Only enabled if Context is missing AND hook is enabled)
    const shouldFallback = !context;
    
    // Legacy onConnect for fallback only
    const handleConnectFallback = useCallback(() => {
        // Fallback-specific logic if needed
    }, []);

    // 3. Fallback Client
    const fallbackClient = useStompClient({
        url: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket',
        token: socketToken,
        enabled: shouldFallback && enabled,
        onConnect: handleConnectFallback
    });

    // 4. Select Active Client
    const client = context || fallbackClient;
    const { isConnected, send, onMessage } = client;

    // 5. Subscription Logic (Runs for BOTH Context and Fallback)
    useEffect(() => {
        if (isConnected && enabled) {
            console.log("[MapSync] Connected. Subscribing to Map Info...");
            send("SUBSCRIBE", {
                id: "sub-map-info",
                destination: WS_TOPICS.MAP_INFO
            });
        }
    }, [isConnected, enabled, send]);

    // 6. Message Processing Logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapMessage = useCallback((msg: any) => {
        // Filter by destination to avoid data leakage (especially telemetry)
        if (msg.destination !== WS_TOPICS.MAP_INFO) return;

        console.log("[MapSync] Received Map Payload", msg.body);
        const result = MapInfoPayloadSchema.safeParse(msg.body);
        
        if (!result.success) {
            console.error("[MapSync] Invalid Map Data Schema:", result.error);
            return;
        }

        const data = result.data;
        
        // Update Corners & Dimensions
        if (data.corners) {
            setCorners(data.corners);

            // const tl = data.corners.TL;
            // const tr = data.corners.TR;
            // const bl = data.corners.BL;

            // const widthM = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
            // const heightM = Math.sqrt(Math.pow(bl.x - tl.x, 2) + Math.pow(bl.y - tl.y, 2));
            
            // PPU (Pixels Per Unit) for MapCanvas
            // const PPU = 20; 
            // const wPx = Math.ceil(widthM * PPU);
            // const hPx = Math.ceil(heightM * PPU);

            // console.log(`[MapSync] Dimensions: ${widthM.toFixed(2)}m x ${heightM.toFixed(2)}m -> ${wPx}x${hPx}px`);
        }

        // Update Graph
        // console.log(`[MapSync] Updating Graph: ${data.nodes.length} nodes, ${data.edges?.length || 0} edges`);
        loadGraph(data.nodes as any, (data.edges || []) as any);
        
    }, [loadGraph, setCorners]);

    // 7. Subscribe to Messages
    useEffect(() => {
        const unsubscribe = onMessage(handleMapMessage);
        return () => unsubscribe();
    }, [onMessage, handleMapMessage]);

    return { isConnected };
}
