import { useMemo } from "react";
import { useGraphStore } from "@/entities/map/model/store";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useMapData } from "./useMapData";

/**
 * Hook: 지도 그리드 메타데이터 및 논리적/물리적 크기 계산
 * FSD: Features layer (map-visualizer)
 */
export function useGridMetadata() {
    // 1. Data Layer
    const { meta, dimensions } = useMapData();
    const { 
        mapWidth: storeMapWidth, 
        mapHeight: storeMapHeight, 
        mapMeta: storeMeta 
    } = useGraphStore();

    // 2. Logic: Compute Grid Metadata (Resolution, Width, Height)
    const gridMetadata = useMemo(() => {
        const effectiveMeta = meta || storeMeta;
        const logicalWidth = dimensions?.width || storeMapWidth || MOCK_MAP_SIZE.width;
        const logicalHeight = dimensions?.height || storeMapHeight || MOCK_MAP_SIZE.height;

        return {
            width: logicalWidth,
            height: logicalHeight,
            resolution: effectiveMeta?.resolution || 0.05,
            origin: effectiveMeta?.origin || storeMeta?.origin || [0, 0, 0] // [Update] Return Origin
        };
    }, [storeMapWidth, storeMapHeight, meta, dimensions, storeMeta]);

    return { gridMetadata };
}
