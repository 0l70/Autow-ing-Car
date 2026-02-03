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

    console.log(`[MapSync Hook] isConnected: ${isConnected}, enabled: ${enabled}`);

    // 5. Subscription Logic (Runs for BOTH Context and Fallback)
    useEffect(() => {
        if (isConnected && enabled) {
            console.log("[MapSync] 🛰️ Attempting Subscription to:", WS_TOPICS.MAP_INFO);
            send("SUBSCRIBE", {
                id: "sub-map-info",
                destination: WS_TOPICS.MAP_INFO
            });
        }
    }, [isConnected, enabled, send]);

    // 6. Data Processing Helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processMapData = useCallback((data: any) => {
        // --- 1. Update Map Dimensions ---
        if (data.width && data.height) {
            setMapDimensions(data.width, data.height);
        }

        // --- 2. Update Map Corners ---
        if (data.corners) {
            setCorners(data.corners);
        }

        // --- 3. Update Graph ---
        // [Fix] Adapter Pattern: Map "Wire Protocol" (from, to) to "Store Protocol" (fromId, toId)
        const adaptedEdges = (data.edges || []).map((e: any) => ({
            ...e,
            fromId: e.from,
            toId: e.to
        }));

        loadGraph(data.nodes as any, adaptedEdges as any);
        console.log(`[MapSync] ✅ Processed ${data.nodes.length} nodes`);
    }, [loadGraph, setCorners, setMapDimensions]);

    // 7. Initial Map Fetch (HTTP)
    useEffect(() => {
        if (!enabled) return;

        const fetchInitialMap = async () => {
            try {
                // Use relative path for production/proxy, fallback for local dev
                const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
                const response = await fetch(`${baseUrl}/api/map/info`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const body = await response.json();
                console.log("[MapSync] 📥 Initial Map Data Received via HTTP:", body);
                
                const result = MapInfoPayloadSchema.safeParse(body);
                if (result.success) {
                    processMapData(result.data);
                } else {
                    console.error("[MapSync] ❌ Initial Map Validation Failed:", result.error.format());
                }
            } catch (err) {
                console.error("[MapSync] ❌ Initial Map Fetch Failed:", err);
            }
        };

        fetchInitialMap();
    }, [enabled, processMapData]);

    // 8. Message Processing Logic (WebSocket)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapMessage = useCallback((msg: any) => {
        if (msg.destination !== WS_TOPICS.MAP_INFO) return;

        console.log("[MapSync] 🎯 MATCH! Map Update Received via WS:", msg.body);
        const result = MapInfoPayloadSchema.safeParse(msg.body);
        
        if (result.success) {
            processMapData(result.data);
        } else {
            console.error("[MapSync] ❌ WS Map Validation Failed:", result.error.format());
        }
    }, [processMapData]);

    // 7. Subscribe to Messages
    useEffect(() => {
        const unsubscribe = onMessage(handleMapMessage);
        return () => unsubscribe();
    }, [onMessage, handleMapMessage]);

    return { isConnected };
}
