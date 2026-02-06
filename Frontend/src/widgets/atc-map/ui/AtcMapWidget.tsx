import { useState, useMemo } from 'react';
import { Map as MapIcon, Maximize2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";

// Shared Map Visualizer Components
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useAutoViewport } from "@/features/map-visualizer/model/useAutoViewport"; 
import { useGridMetadata } from "@/features/map-visualizer/model/useGridMetadata"; 

interface AtcMapWidgetProps {
    className?: string;
    onAircraftSelect?: (aircraftId: string | null) => void;
}

export function AtcMapWidget({ className, onAircraftSelect }: AtcMapWidgetProps) {
    // 1. Data Layer
    const { meta, mapImage, dimensions } = useMapData(); 
    const { mapMeta: storeMeta, nodes } = useGraphStore();
    
    // Map Load Handler
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // 2. Logic Layer: Grid Metadata (FSD Hook)
    const { gridMetadata: rawGridMetadata } = useGridMetadata();

    // [Update] 1.2x Grid Expansion Logic (Virtual Map) - Matching Pilot Map
    const paddedGridMetadata = useMemo(() => {
        const expansionRatio = 0.2; // Total +20%
        const sideRatio = 0.1;      // +10% per side

        const extraW = rawGridMetadata.width * expansionRatio;
        const extraH = rawGridMetadata.height * expansionRatio;

        const newWidth = rawGridMetadata.width + extraW;
        const newHeight = rawGridMetadata.height + extraH;

        // Calculate Metric Padding (Meters)
        const padX_Meters = (rawGridMetadata.width * sideRatio) * rawGridMetadata.resolution;
        const padY_Meters = (rawGridMetadata.height * sideRatio) * rawGridMetadata.resolution;

        // Shift Origin
        const baseOrigin = rawGridMetadata.origin || [0,0,0];
        
        return {
            ...rawGridMetadata,
            width: newWidth,
            height: newHeight,
            origin: [
                baseOrigin[0] - padX_Meters,
                baseOrigin[1] - padY_Meters,
                baseOrigin[2]
            ]
        };
    }, [rawGridMetadata]);

    // Dimensions to use
    const activeWidth = loadedDims.width || paddedGridMetadata.width;
    const activeHeight = loadedDims.height || paddedGridMetadata.height;

    // Viewport Logic (Feature Hook)
    // Dynamic Fit to Nodes (Like Pilot Map) but for Overview
    const { viewBox: dynamicViewBox } = useAutoViewport(
        nodes, 
        paddedGridMetadata as any, 
        paddedGridMetadata.height,     
        paddedGridMetadata.width, 
        paddedGridMetadata.height,
        { paddingScale: 0.05, minPadding: 2 } // Consistent with Pilot Overview
    );

    const handleAircraftClick = (ac: Aircraft) => {
        console.log("ATC Selected Aircraft:", ac.id);
        if (onAircraftSelect) {
            onAircraftSelect(ac.id);
        }
    };

    return (
        <Card className={`glass-panel relative overflow-hidden flex flex-col ${className}`}>
            <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur justify-between flex-row items-center">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-500" /> {/* Emerald for ATC/Ground */}
                    Map
                </CardTitle>

            </CardHeader>
            <div className="flex-1 relative bg-[#0a0a0f] overflow-hidden">
                <MapCanvas
                    // Data
                    mapImage={mapImage || null}
                    meta={paddedGridMetadata as any}
                    
                    // Config
                    visualStyle="abstract" 
                    gridMetadata={paddedGridMetadata}
                    pixelRatio={5} 
                    
                    // Viewport Control
                    initialViewBox={dynamicViewBox}
                    maxBounds={dynamicViewBox}
                    
                    // Grid Customization (Match Pilot Style)
                    gridOptions={{
                        majorInterval: 1.5,
                        minorInterval: 0.5,
                        majorWidth: 0.3, 
                        minorWidth: 0.1, 
                        majorColor: 'rgba(0, 255, 255, 0.2)', 
                        minorColor: 'rgba(255, 255, 255, 0.3)' 
                    }}
                    
                    className="w-full h-full"
                    onMapLoad={setLoadedDims}
                    onMapClick={(pos) => console.log("ATC Map Click:", pos)}
                >
                    {/* Render Layers */}
                    <GraphLayer 
                        meta={paddedGridMetadata as any} 
                        mapHeight={activeHeight} 
                    />
                    
                    <AircraftLayer
                        meta={paddedGridMetadata as any}
                        mapWidth={activeWidth}
                        mapHeight={activeHeight}
                        pixelRatio={5}
                        onAircraftClick={handleAircraftClick}
                    />
                    
                    {/* Future: RadarLayer, ExclusionZonesLayer etc. */}
                </MapCanvas>
            </div>
            

        </Card>
    );
}
