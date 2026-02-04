import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import { MapMeta } from "@/entities/map/model/types";
import { MapMetaSchema } from "@/entities/map/model/schema";
import { loadPGM } from "@/entities/map/lib/pgmParser";

/**
 * 훅: 지도 데이터 로딩 (Meta + Image)
 * @param mapName 로드할 맵 이름 (파일명, 확장자 제외)
 */
export function useMapData(mapName: string) {
    // 1. 메타데이터 Fetch
    const { data: meta, isLoading: isMetaLoading, error: metaError } = useQuery({
        queryKey: ['map', mapName, 'meta'],
        queryFn: async () => {
             const res = await fetch(`/maps/${mapName}.yaml`);
             if (!res.ok) throw new Error('Failed to load map metadata');
             const text = await res.text();
             const parsed = yaml.load(text);
             return MapMetaSchema.parse(parsed); 
        },
        staleTime: Infinity, // 맵 데이터는 잘 안바뀜
    });

    // 2. 이미지 Fetch (Meta가 있어야 함)
    const { data: mapImage, isLoading: isImageLoading, error: imageError } = useQuery({
        queryKey: ['map', mapName, 'image'],
        queryFn: async () => {
            if (!meta) return null;
            // TODO: 실제로는 meta.image 파일명을 써야 하지만 경로 문제로 단순화
            const imagePath = `/maps/${meta.image}`; 
            return loadPGM(imagePath);
        },
        enabled: !!meta,
        staleTime: Infinity,
    });

    return {
        meta,
        mapImage,
        isLoading: isMetaLoading || isImageLoading,
        error: metaError || imageError
    };
}
