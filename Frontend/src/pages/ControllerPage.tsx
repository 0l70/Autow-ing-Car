import { useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { AtcMapWidget } from "@/widgets/atc-map";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useMapLoader } from "@/features/map-visualizer/model/useMapLoader";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";
import { useMapSync } from "@/features/map-visualizer/model/useMapSync";
import { useGraphStore } from "@/entities/map/model/store";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";

export function ControllerPage() {
    // --- 1. Map Data Loading (Hook) ---
    // Single source of truth for map data
    const { meta: mapMeta, mapImage } = useMapData('final_map');
    
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
                    <AtcMapWidget className="w-full h-full" />
                </div>
            </div>
        </MainLayout>
    );
}
