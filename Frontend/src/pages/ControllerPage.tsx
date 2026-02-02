import { useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { MapCanvas } from "@/widgets/map-panel/MapCanvas_deprecated";
import { GraphEditorLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";
import { useMapSync } from "@/features/map-visualizer/model/useMapSync";
import { useMapLoader } from "@/features/map-visualizer/model/useMapLoader";
import { useMapData } from "@/features/map-visualizer/model/useMapData";

export function ControllerPage() {
    // --- 1. Map Data Loading (Hook) ---
    // Single source of truth for map data
    const { meta: mapMeta, mapImage } = useMapData('pilot_grid');
    
    // --- 2. Store & Local State ---
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [mapHeight, setMapHeight] = useState(0); // Layout height from canvas
    const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
    
    // --- DATA SOURCE CONTROL ---
    const USE_REAL_DATA = true;
    
    // 3. Logic Hooks
    useMapLoader(); 
    useTelemetrySocket(undefined, USE_REAL_DATA);
    useMapSync(USE_REAL_DATA);
    
    // 4. Handlers
    const handleMapLoad = useCallback((info: { width: number; height: number }) => {
        // Only care about layout dimensions here
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
            rightPanel={<MissionInspector selectedAircraftId={selectedAircraftId} />}
        >
            <div className="absolute inset-0 flex items-center justify-center p-8">
                {/* Map Container */}
                <div className="relative w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-black/20 overflow-hidden">

                    {/* Map Legend */}
                    <div className="absolute top-4 left-4 p-3 bg-black/80 rounded-lg border border-white/10 text-xs shadow-lg backdrop-blur z-20 pointer-events-none">
                        <div className="text-gray-400 font-bold mb-2 uppercase tracking-wider text-[10px]">Map Legend</div>
                        
                        {/* Routes */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-0.5 bg-accent-orange shadow-[0_0_5px_rgba(255,120,0,1)]"></span>
                            <span className="text-white font-mono">Confirmed Route</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-0.5 bg-accent-cyan/50 dashed border-b border-dashed border-accent-cyan"></span>
                            <span className="text-gray-400 font-mono">Candidate Route</span>
                        </div>

                        {/* Nodes */}
                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm bg-blue-500 border border-blue-300 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></span>
                                <span className="text-gray-300 font-mono text-[10px]">RUNWAY</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500 border border-green-300 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
                                <span className="text-gray-300 font-mono text-[10px]">GATE (Stand)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-300 shadow-[0_0_5px_rgba(234,179,8,0.8)]"></span>
                                <span className="text-gray-300 font-mono text-[10px]">CHARGER</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 border border-gray-300"></span>
                                <span className="text-gray-400 font-mono text-[10px]">INTERSECTION</span>
                            </div>
                        </div>
                    </div>

                    {/* NEON GRID MAP SYSTEM */}
                    <MapCanvas
                        // Data Props
                        mapImage={mapImage || null}
                        meta={mapMeta || null} // Hook에서 받은 meta 전달 (비동기 로딩)
                        
                        // Config (Fallback)
                        visualStyle="default"
                        gridMetadata={gridMetadata}
                        
                        className="w-full h-full"
                        onMapLoad={handleMapLoad} // Only receives size now
                        onMapClick={(pos) => console.log("Dashboard Click:", pos)}
                    >
                        {/* 1. Topological Graph Layer (Nodes & Edges) */}
                        <GraphEditorLayer meta={mapMeta || null} mapHeight={mapHeight} />

                        {/* 2. Aircraft Overlay (Simulated) */}
                        <AircraftLayer
                            meta={mapMeta || null}
                            mapWidth={storeMapWidth || MOCK_MAP_SIZE.width}
                            mapHeight={storeMapHeight || MOCK_MAP_SIZE.height}
                            onAircraftClick={(ac) => {
                                console.log("Selected Aircraft:", ac.callsign);
                                setSelectedAircraftId(ac.id);
                            }}
                        />
                    </MapCanvas>

                </div>
            </div>
        </MainLayout>
    );
}
