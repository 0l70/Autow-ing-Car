import { useMemo } from 'react';
import { useAircraftStore } from "@/entities/aircraft";
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";
import { MAP_CONFIG } from '@/features/map-visualizer/model/mapConfig';
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { MapMeta } from "@/entities/map/model/types";

interface ConnectionRippleLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
}

export function ConnectionRippleLayer({ meta, mapHeight }: ConnectionRippleLayerProps) {
    const { aircrafts } = useAircraftStore();
    const { scale, offset } = useMapCamera();

    // 1. Filter Active Aircraft (Exclude IDLE)
    // Only show ripple for connected aircraft involved in some operation or movement
    const activeAircrafts = useMemo(() => {
        return aircrafts.filter(ac => ac.status !== 'IDLE' && ac.status !== 'STOP' && ac.status !== 'ERROR');
    }, [aircrafts]);

    if (!meta || mapHeight === 0 || activeAircrafts.length === 0) return null;

    return (
        <div 
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: MAP_CONFIG.Z_INDEX.RIPPLE_LAYER }}
        >
            {activeAircrafts.map(ac => {
                // 2. Calculate Screen Position
                const mapPos = worldToPixel(ac.position, meta, mapHeight);
                const screenX = offset.x + (mapPos.x * scale);
                const screenY = offset.y + (mapPos.y * scale);

                return (
                    <div 
                        key={ac.id}
                        className="absolute w-0 h-0 flex items-center justify-center"
                        style={{ left: screenX, top: screenY }}
                    >
                        {/* 
                           CSS Animation for Ripple 
                           - Use Emerald (Green) for "Active/Online" status
                           - 3 rings to create a dense "two+ lines" effect
                        */}
                        <div className="absolute w-[80px] h-[80px] rounded-full border-2 border-emerald-400 opacity-0 animate-ripple-expand shadow-[0_0_15px_rgba(52,211,153,0.6)]" style={{ animationDelay: '0s' }} />
                        <div className="absolute w-[80px] h-[80px] rounded-full border border-emerald-400 opacity-0 animate-ripple-expand" style={{ animationDelay: '0.7s' }} />
                    </div>
                );
            })}

            {/* Local Styles for Ripple Animation */}
            <style>
                {`
                @keyframes ripple-expand {
                    0% { transform: scale(0.2); opacity: 0.8; border-width: 3px; }
                    50% { opacity: 0.5; }
                    100% { transform: scale(1.2); opacity: 0; border-width: 0px; }
                }
                .animate-ripple-expand {
                    animation: ripple-expand 2.1s infinite ease-out;
                }
                `}
            </style>
        </div>
    );
}
