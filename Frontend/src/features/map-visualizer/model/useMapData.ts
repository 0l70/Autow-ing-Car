import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapMeta } from "@/entities/map/model/types";
import { MapMetaSchema } from "@/entities/map/model/schema";
import { loadPGM } from "@/entities/map/lib/pgmParser";
import { useGraphStore } from "@/entities/map/model/store";

/**
 * 훅: 지도 데이터 로딩 (Backend API 기반)
 */
export function useMapData() {
    const { loadGraph, setMapMeta, setMapDimensions } = useGraphStore();

    // 1. 백엔드에서 모든 지도 정보(메타 + 노드 + 엣지) Fetch
    const { data: mapInfo, isLoading: isInfoLoading, error: infoError } = useQuery({
        queryKey: ['map', 'info'],
        queryFn: async () => {
             const res = await fetch(`/api/map/info`);
             if (!res.ok) throw new Error('Failed to load map data from server');
             return res.json();
        },
        staleTime: Infinity,
    });

    // 2. 이미지 Fetch (mapInfo가 있어야 함)
    const { data: mapImage, isLoading: isImageLoading, error: imageError } = useQuery({
        queryKey: ['map', 'image', mapInfo?.imagePath],
        queryFn: async () => {
            if (!mapInfo || !mapInfo.imagePath) return null;
            const imagePath = `/maps/${mapInfo.imagePath}`; 
            return loadPGM(imagePath);
        },
        enabled: !!mapInfo,
        staleTime: Infinity,
    });

    // 3. 데이터를 Store에 동기화
    useEffect(() => {
        if (mapInfo) {
            // Transform backend response to MapMeta format
            const meta = MapMetaSchema.parse({
                image: mapInfo.imagePath,
                resolution: mapInfo.resolution,
                origin: [mapInfo.originX || 0, mapInfo.originY || 0, 0]
            });
            
            setMapMeta(meta);
            setMapDimensions(mapInfo.width, mapInfo.height);

            // DTO -> GraphEntity 변환 (fromId/toId 매핑)
            const graphNodes = mapInfo.nodes.map((n: any) => ({
                id: n.id,
                x: n.x,
                y: n.y,
                type: (() => {
                    const code = n.id.toUpperCase();
                    if (code.startsWith('R') || code.startsWith('S')) return 'RUNWAY';
                    if (code.startsWith('G')) return 'GATE';
                    if (code.startsWith('C') || code.startsWith('P')) return 'CHARGER';
                    if (code.startsWith('I')) return 'INTERSECTION';
                    return 'WAYPOINT';
                })(),
                status: n.status
            }));

            const graphEdges = mapInfo.edges.map((e: any) => ({
                id: e.id,
                fromId: e.from,
                toId: e.to,
                cost: e.cost,
                waypoints: e.waypoints
            }));

            loadGraph(graphNodes, graphEdges);
            console.log(`[useMapData] Map metadata and graph loaded into store.`);
        }
    }, [mapInfo, setMapMeta, setMapDimensions, loadGraph]);

    return {
        meta: mapInfo ? MapMetaSchema.parse({
            image: mapInfo.imagePath,
            resolution: mapInfo.resolution,
            origin: [mapInfo.originX || 0, mapInfo.originY || 0, 0]
        }) : null,
        mapImage,
        isLoading: isInfoLoading || isImageLoading,
        error: infoError || imageError,
        dimensions: mapInfo ? { width: mapInfo.width, height: mapInfo.height } : null
    };
}
