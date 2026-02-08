import { useState, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";

// Shared Map Visualizer Components
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useAutoViewport } from "@/features/map-visualizer/model/useAutoViewport";
import { useGridMetadata } from "@/features/map-visualizer/model/useGridMetadata";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

// Layers
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { DestinationLayer } from "@/features/map-visualizer/ui/DestinationLayer";
import { ConnectionRippleLayer } from "@/features/map-visualizer/ui/ConnectionRippleLayer";

interface AtcMapWidgetProps {
    className?: string;
    onAircraftSelect?: (aircraftId: string | null) => void;
}

export function AtcMapWidget({ className, onAircraftSelect }: AtcMapWidgetProps) {
    // 1. Data Layer
    const { mapImage } = useMapData(); 
    const { nodes, highlightedPath, activeDestinationNodeId } = useGraphStore();
    const { gridMetadata: rawGridMetadata } = useGridMetadata();
    
    // Map Load Handler
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });

    // 2. Logic: Grid & Viewport (Sync with Pilot Map Padding)
    const paddedGridMetadata = useMemo(() => {
         const expansionRatio = 0.2; // +20%
         const sideRatio = 0.1;      // +10% per side

         const extraW = rawGridMetadata.width * expansionRatio;
         const extraH = rawGridMetadata.height * expansionRatio;

         const finalW = rawGridMetadata.width + extraW;
         const finalH = rawGridMetadata.height + extraH;

         const padX = (rawGridMetadata.width * sideRatio) * rawGridMetadata.resolution;
         const padY = (rawGridMetadata.height * sideRatio) * rawGridMetadata.resolution;

         const baseOrigin = rawGridMetadata.origin || [0, 0, 0];

         return {
             ...rawGridMetadata,
             width: finalW,
             height: finalH,
             origin: [
                 baseOrigin[0] - padX,
                 baseOrigin[1] - padY,
                 baseOrigin[2]
             ] as [number, number, number]
         };
    }, [rawGridMetadata]);

    const activeWidth = loadedDims.width || paddedGridMetadata.width;
    const activeHeight = loadedDims.height || paddedGridMetadata.height;

    // Viewport Logic
    const { viewBox: autoViewBox } = useAutoViewport(
        nodes,
        paddedGridMetadata as any,
        paddedGridMetadata.height,
        paddedGridMetadata.width,
        paddedGridMetadata.height,
        { 
            paddingScale: 0.05, 
            minPadding: 2 
        } 
    );

    return (
        <Card className={`flex flex-col h-full bg-[#0B0F1A]/95 border-[#1E293B] shadow-2xl relative overflow-hidden ${className}`}>
            <CardHeader className="flex flex-row items-center space-x-2 py-3 px-4 border-b border-[#1E293B] bg-[#0F172A]/50 z-10">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    <MapIcon className="w-4 h-4 text-blue-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-slate-200 tracking-tight">
                    AIRPORT GROUND CHART (ATC VIEW)
                </CardTitle>
            </CardHeader>
            
            <div className="flex-grow relative bg-[#020617] cursor-crosshair overflow-hidden">
                <MapCanvas 
                    mapImage={mapImage || null} 
                    meta={paddedGridMetadata as any}
                    gridMetadata={paddedGridMetadata}
                    visualStyle="abstract" // [FIX] Neon Grid Fallback
                    onMapLoad={setLoadedDims} 
                    initialViewBox={autoViewBox}
                    maxBounds={autoViewBox}
                    pixelRatio={5}
                    gridOptions={{
                        majorInterval: 1.5,
                        minorInterval: 0.5,
                        majorWidth: 0.3,
                        minorWidth: 0.1,
                        majorColor: 'rgba(0, 255, 255, 0.2)',
                        minorColor: 'rgba(255, 255, 255, 0.3)'
                    }}
                    className="w-full h-full"
                >
                    {/* 3. Graph Layout (Roads & Nodes) */}
                    <GraphLayer 
                        meta={paddedGridMetadata as any} 
                        mapHeight={activeHeight} 
                        overridePath={highlightedPath}
                    />
                    
                    {/* 4. Connection Ripple Layer (Below Aircraft) */}
                    <ConnectionRippleLayer 
                        meta={paddedGridMetadata as any}
                        mapHeight={activeHeight}
                    />

                    {/* 5. Aircrafts & Vehicles Layer */}
                    <AircraftLayer 
                        meta={paddedGridMetadata as any} 
                        mapHeight={activeHeight} 
                        mapWidth={activeWidth}
                        pixelRatio={5}
                        onAircraftClick={(ac) => onAircraftSelect?.(ac.id)}
                    />

                    {/* 6. Mission Destination Marker (Always on Top) */}
                    <DestinationLayer 
                        meta={paddedGridMetadata as any} 
                        mapHeight={activeHeight} 
                        overrideNodeId={activeDestinationNodeId}
                    />
                </MapCanvas>
            </div>
            
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2 pointer-events-none">
                <div className="px-3 py-1.5 bg-[#0F172A]/90 backdrop-blur-md border border-[#1E293B] rounded-full flex items-center space-x-2 shadow-xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Live Telemetry Active</span>
                </div>
            </div>
        </Card>
    );
}
