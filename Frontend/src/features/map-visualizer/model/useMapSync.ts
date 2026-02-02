import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { useSocket } from '@/shared/realtime/context/SocketProvider';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { MapInfoPayloadSchema } from '@/shared/realtime/api/map.schema';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

export function useMapSync(enabled: boolean = true) {
    const { loadGraph, setCorners, setMapDimensions } = useGraphStore();
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
        
        // [New] Update Map Dimensions from Payload
        if (data.width && data.height) {
             setMapDimensions(data.width, data.height);
             // console.log(`[MapSync] Synced Map Size: ${data.width}x${data.height}`);
        }

        // Update Corners
        if (data.corners) {
            setCorners(data.corners);
        }

        // Update Graph
        // [Fix] Adapter Pattern: Map "Wire Protocol" (from, to) to "Store Protocol" (fromId, toId)
        const adaptedEdges = (data.edges || []).map((e: any) => ({
            ...e,
            fromId: e.from,
            toId: e.to
        }));

        loadGraph(data.nodes as any, adaptedEdges as any);
        
    }, [loadGraph, setCorners, setMapDimensions]);

    // 7. Subscribe to Messages
    useEffect(() => {
        const unsubscribe = onMessage(handleMapMessage);
        return () => unsubscribe();
    }, [onMessage, handleMapMessage]);

    return { isConnected };
}
