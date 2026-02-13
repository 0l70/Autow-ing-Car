import { useQuery } from "@tanstack/react-query";
import { loadPGM } from "@/entities/map/lib/pgmParser";
import { useGraphStore } from "@/entities/map/model/store";

/**
 * 훅: 지도 시각화용 데이터 가공 (View 전용)
 * 실제 데이터 Fetch는 SocketBridge에서 수행하고, 이 훅은 이미지 로딩 및 UI 가공만 담당합니다.
 */
export function useMapData() {
    const { mapMeta, mapWidth, mapHeight } = useGraphStore();

    // 이미지 Fetch (mapMeta 정보가 있을 때만 실행)
    const { data: mapImage, isLoading: isImageLoading, error: imageError } = useQuery({
        queryKey: ['map', 'image', mapMeta?.image],
        queryFn: async () => {
            if (!mapMeta || !mapMeta.image) return null;
            const imagePath = `/maps/${mapMeta.image}`; 
            return loadPGM(imagePath);
        },
        enabled: !!mapMeta?.image,
        staleTime: Infinity,
    });

    return {
        meta: mapMeta,
        mapImage,
        isLoading: !mapMeta || isImageLoading,
        error: imageError,
        dimensions: { width: mapWidth, height: mapHeight }
    };
}


