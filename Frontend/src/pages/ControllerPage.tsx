import { useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { MapCanvas } from "@/widgets/map-panel/MapCanvas";
import { GraphInteractionLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";
import { useMapSync } from "@/features/map-visualizer/model/useMapSync";
import { useMapLoader } from "@/features/map-visualizer/model/useMapLoader";

export function ControllerPage() {
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
    const [mapHeight, setMapHeight] = useState(0);
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
    
    // --- DATA SOURCE CONTROL ---
    const USE_REAL_DATA = true;
    
    // 1. Data Loading Hooks
    useMapLoader(); // Load Static Map Data
    useTelemetrySocket(undefined, USE_REAL_DATA); // Live Traffic (Global)
    useMapSync(USE_REAL_DATA); // Sync Dynamic Map Elements
    
    // 2. Handlers
    const handleMapLoad = useCallback((info: { meta: MapMeta; width: number; height: number }) => {
        setMapMeta(info.meta);
        setMapHeight(info.height);
    }, []);

    const gridMetadata = useMemo(() => ({
        width: storeMapWidth || MOCK_MAP_SIZE.width,
        height: storeMapHeight || MOCK_MAP_SIZE.height,
        resolution: 0.05
    }), [storeMapWidth, storeMapHeight]);

    // 3. Render
    return (
        <MainLayout
            leftPanel={
                <>
                    <ApprovalQueue />
                    <ActivityTimeline />
                </>
            }
            rightPanel={<MissionInspector selectedAircraft={selectedAircraft} />}
        >
            <div className="absolute inset-0 flex items-center justify-center p-8">
                {/* Map Container */}
                <div className="relative w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-black/20 overflow-hidden">

                    {/* Map Legend */}
                    <div className="absolute top-4 left-4 p-3 bg-black/80 rounded-lg border border-white/10 text-xs shadow-lg backdrop-blur z-20 pointer-events-none">
                        <div className="text-gray-400 font-bold mb-2 uppercase tracking-wider text-[10px]">Map Legend</div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-0.5 bg-accent-orange shadow-[0_0_5px_rgba(255,120,0,1)]"></span>
                            <span className="text-white font-mono">Confirmed Route</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-0.5 bg-accent-cyan/50 dashed border-b border-dashed border-accent-cyan"></span>
                            <span className="text-gray-400 font-mono">Candidate Route</span>
                        </div>
                    </div>

                    {/* NEON GRID MAP SYSTEM */}
                    <MapCanvas
                        mapName="virtual_grid"
                        visualStyle="abstract"
                        gridMetadata={gridMetadata}
                        className="w-full h-full"
                        onMapLoad={handleMapLoad}
                        onMapClick={(pos) => console.log("Dashboard Click:", pos)}
                    >
                        {/* 1. Topological Graph Layer (Nodes & Edges) */}
                        <GraphInteractionLayer meta={mapMeta} mapHeight={mapHeight} />

                        {/* 2. Aircraft Overlay (Simulated) */}
                        <AircraftLayer
                            meta={mapMeta}
                            mapWidth={storeMapWidth || MOCK_MAP_SIZE.width}
                            mapHeight={storeMapHeight || MOCK_MAP_SIZE.height}
                            onAircraftClick={(ac) => {
                                console.log("Selected Aircraft:", ac.callsign);
                                setSelectedAircraft(ac);
                            }}
                        />
                    </MapCanvas>

                </div>
            </div>
        </MainLayout>
    );
}
