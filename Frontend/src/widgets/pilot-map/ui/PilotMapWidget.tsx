import { useState, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { useAircraftStore } from "@/entities/aircraft"; 
import { usePilotController } from "@/features/pilot-actions/model/usePilotController"; 

// FSD Layers
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useAutoViewport } from "@/features/map-visualizer/model/useAutoViewport"; 
import { useGridMetadata } from "@/features/map-visualizer/model/useGridMetadata"; 

interface PilotMapWidgetProps {
    className?: string;
    onAircraftSelect?: ((aircraft: Aircraft | null) => void) | undefined;
}

export function PilotMapWidget({ className, onAircraftSelect }: PilotMapWidgetProps) {
    // 1. Data Layer
    const { meta, mapImage } = useMapData();
    const { mapMeta: storeMeta, nodes } = useGraphStore(); 
    
    // Pilot Context
    const { state: pilotState } = usePilotController();
    const assignedCarId = pilotState.flightInfo?.assignedCarId;
    const allAircrafts = useAircraftStore(state => state.aircrafts);

    // 2. Logic Layer
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // Grid & Dimensions
    const { gridMetadata: rawGridMetadata } = useGridMetadata();

    // 1.2x Grid Expansion Logic (Virtual Map)
    const paddedGridMetadata = useMemo(() => {
        const expansionRatio = 0.2; 
        const sideRatio = 0.1;      

        const extraW = rawGridMetadata.width * expansionRatio;
        const extraH = rawGridMetadata.height * expansionRatio;

        const newWidth = rawGridMetadata.width + extraW;
        const newHeight = rawGridMetadata.height + extraH;

        const padX_Meters = (rawGridMetadata.width * sideRatio) * rawGridMetadata.resolution;
        const padY_Meters = (rawGridMetadata.height * sideRatio) * rawGridMetadata.resolution;

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

    // Viewport Logic (Feature Hook)
    // [Revert] Back to "Overview Mode" (Show Whole Path) 
    // Removed Focusing Logic
    const { viewBox: dynamicViewBox } = useAutoViewport(
        nodes, 
        paddedGridMetadata as any, 
        paddedGridMetadata.height,     
        paddedGridMetadata.width, 
        paddedGridMetadata.height,
        { paddingScale: 0.05, minPadding: 2 }
    );

    // Filter Logic
    const myAircraftData = useMemo(() => {
        return assignedCarId 
            ? allAircrafts.filter(a => a.id === assignedCarId) 
            : []; 
    }, [allAircrafts, assignedCarId]);

    const activeWidth = loadedDims.width || paddedGridMetadata.width;
    const activeHeight = loadedDims.height || paddedGridMetadata.height;

    // 3. UI Layer
    return (
        <Card className={`glass-panel relative overflow-hidden flex flex-col ${className}`}>
            <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-cyan-500" />
                    DIGITAL TWIN NAVIGATION
                </CardTitle>
            </CardHeader>
            <div className="flex-1 relative bg-black/40 overflow-hidden">
                    <MapCanvas
                        // Data
                        mapImage={mapImage || null}
                        meta={paddedGridMetadata as any} 
                        
                        // Config
                        visualStyle="abstract"
                        gridMetadata={paddedGridMetadata} 
                        pixelRatio={5} 
                        
                        // Viewport
                        initialViewBox={dynamicViewBox}
                        maxBounds={dynamicViewBox}
                        
                        // Grid Options
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
                        onMapClick={(pos) => console.log("Pilot Map Click:", pos)}
                    >
                        {/* Layers */}
                        <GraphLayer meta={paddedGridMetadata as any} mapHeight={activeHeight} />
                        
                        <AircraftLayer
                            meta={paddedGridMetadata as any}
                            mapWidth={activeWidth}
                            mapHeight={activeHeight}
                            pixelRatio={5} // High-Res
                            data={myAircraftData}
                            onAircraftClick={(ac) => onAircraftSelect?.(ac)} 
                        />
                    </MapCanvas>
            </div>
        </Card>
    );
}
