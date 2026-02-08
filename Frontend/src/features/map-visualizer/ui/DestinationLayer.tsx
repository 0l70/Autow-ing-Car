import { useMemo } from 'react';
import { useGraphStore } from "@/entities/map/model/store";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { MapPin } from "lucide-react";
import { MapMeta } from "@/entities/map/model/types";

interface DestinationLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
    overrideNodeId?: string;
}

export function DestinationLayer({ meta, mapHeight, overrideNodeId }: DestinationLayerProps) {
    const { nodes, activeDestinationNodeId } = useGraphStore();
    
    // 1. Determine Target ID (Pilot Override -> ATC Store)
    const targetId = overrideNodeId || activeDestinationNodeId;

    // 2. Find Node & Calculate Position
    const pinPosition = useMemo(() => {
        if (!targetId || !meta || mapHeight === 0) return null;

        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) return null;

        return worldToPixel(targetNode, meta, mapHeight);
    }, [targetId, meta, mapHeight, nodes]);

    if (!pinPosition) return null;

    return (
        <div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 60 }} // Above Aircraft (50)
        >
            <div 
                style={{ 
                    left: pinPosition.x, 
                    top: pinPosition.y,
                    transform: 'translate(-50%, -100%)' // Pin tip at exact coordinate
                }}
                className="absolute flex flex-col items-center animate-bounce-slow"
            >
                {/* Pin Icon */}
                <div className="relative">
                    <MapPin 
                        className="w-10 h-10 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] filter" 
                        fill="#EF4444" 
                        stroke="#7F1D1D"
                        strokeWidth={1.5}
                    />
                    {/* Fake Shadow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-black/60 blur-[3px] rounded-full scale-x-100 animate-pulse" />
                </div>

                {/* Label Badge */}
                <span className="mt-1 px-2.5 py-0.5 bg-black/80 border border-red-500/30 text-white text-[10px] font-bold rounded-full backdrop-blur-sm shadow-xl flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    DESTINATION
                </span>
            </div>

            {/* CSS Animation for smoother bounce if needed (Tailwind 'animate-bounce' is a bit too fast) */}
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
