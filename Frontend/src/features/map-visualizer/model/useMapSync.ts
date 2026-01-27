import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { useStompClient } from '@/shared/realtime/clients/useStompClient';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { MapInfoPayloadSchema } from '@/shared/realtime/api/map.schema';
import { useAuthStore } from '@/features/auth/model/useAuthStore';

export function useMapSync(enabled: boolean = true) {
    const { loadGraph, setCorners, setMapDimensions } = useGraphStore();
    const { socketToken } = useAuthStore();

    // Memoize onConnect to prevent infinite effect triggers in useStompClient
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log("[MapSync] Connected. Subscribing to Map Info...");
        sendFn("SUBSCRIBE", {
            id: "sub-map-info",
            destination: WS_TOPICS.MAP_INFO
        });
    }, []);

    // Use shared client
    const { isConnected, onMessage } = useStompClient({
        url: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket',
        token: socketToken,
        enabled,
        onConnect: handleConnect
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapMessage = useCallback((payload: any) => {
        console.log("[MapSync] Received Map Payload", payload);
        const result = MapInfoPayloadSchema.safeParse(payload);
        
        if (!result.success) {
            console.error("[MapSync] Invalid Map Data:", result.error);
            return;
        }

        const data = result.data;
        
        // 1. Update Corners
        if (data.corners) {
            setCorners(data.corners);

            // Calculate Dimensions (Meters)
            // Width = Distance(TL, TR)
            const tl = data.corners.TL;
            const tr = data.corners.TR;
            const bl = data.corners.BL;

            const widthM = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
            const heightM = Math.sqrt(Math.pow(bl.x - tl.x, 2) + Math.pow(bl.y - tl.y, 2));
            
            // MapCanvas Abstract Mode uses "Grid Units" which we map to Meters.
            // If resolution is 0.05 m/px, then Width(px) = Width(m) / 0.05
            // But MapCanvas receives `gridMetadata.width/height` as the canvas size?
            // "width = gridMetadata?.width || 2000;" -> This sets canvas.width.
            
            // If we want the canvas to represent the real world, we need to choose a PPU.
            const PPU = 20; // 20 pixels per meter (0.05 resolution)
            
            // Or we can just store the meters and let the Canvas handle PPU?
            // MapCanvas logic: "const resolution = gridMetadata?.resolution || 0.05;"
            // "canvas.width = gridMetadata.width"
            
            // Issue: if we pass Width in Meters (e.g. 100m) to canvas.width, the canvas is tiny (100px).
            // We MUST convert to Pixels for the store if the store is driving the Canvas size props.
            
            const wPx = Math.ceil(widthM * PPU);
            const hPx = Math.ceil(heightM * PPU);

        console.log(`[MapSync] Dimensions: ${widthM.toFixed(2)}m x ${heightM.toFixed(2)}m -> ${wPx}x${hPx}px`);
        }

        // 2. Update Graph
        console.log(`[MapSync] Updating Graph: ${data.nodes.length} nodes, ${data.edges?.length || 0} edges`);
        loadGraph(data.nodes, data.edges || []);
        
    }, [loadGraph, setCorners, setMapDimensions]);

    useEffect(() => {
        const unsubscribe = onMessage(handleMapMessage);
        return () => unsubscribe();
    }, [onMessage, handleMapMessage]);

    return { isConnected };
}
