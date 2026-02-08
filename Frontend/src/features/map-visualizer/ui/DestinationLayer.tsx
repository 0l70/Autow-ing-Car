import { useMemo } from 'react';
import { useGraphStore } from "@/entities/map/model/store";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { MapPin } from "lucide-react";
import { MapMeta } from "@/entities/map/model/types";
import { MAP_CONFIG } from '@/features/map-visualizer/model/mapConfig';
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";

interface DestinationLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
    overrideNodeId?: string | null | undefined;
}

export function DestinationLayer({ meta, mapHeight, overrideNodeId }: DestinationLayerProps) {
    const { nodes } = useGraphStore();
    const { scale, offset } = useMapCamera();
    
    // 1. Determine Target ID (Strict Prop Control)
    const targetId = overrideNodeId;

    // 2. Find Node & Calculate Position (Map Space)
    const mapPos = useMemo(() => {
        if (!targetId || !meta || mapHeight === 0) return null;

        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) return null;
        
        return worldToPixel(targetNode, meta, mapHeight);
    }, [targetId, meta, mapHeight, nodes]);

    if (!mapPos) return null;

    // 3. Apply Camera Transform (Map Space -> Screen Space)
    const screenX = offset.x + (mapPos.x * scale);
    const screenY = offset.y + (mapPos.y * scale);

    return (
        <div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: MAP_CONFIG.Z_INDEX.DESTINATION_LAYER }}
        >
            <div 
                style={{ 
                    left: screenX, 
                    top: screenY,
                    transform: 'translate(-50%, -100%)'
                }}
                className="absolute flex flex-col items-center animate-bounce-slow"
            >
                <div className="relative">
                    <MapPin 
                        className="w-10 h-10 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] filter" 
                        fill="#EF4444" 
                        stroke="#7F1D1D"
                        strokeWidth={1.5}
                    />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-black/60 blur-[3px] rounded-full scale-x-100 animate-pulse" />
                </div>
            </div>

            <style>
                {`
                @keyframes bounce-slow {
                    0%, 100% { transform: translate(-50%, -100%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                    50% { transform: translate(-50%, -125%); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite;
                }
                `}
            </style>
        </div>
    );
}
