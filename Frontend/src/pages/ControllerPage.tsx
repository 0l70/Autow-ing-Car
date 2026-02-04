import { useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { AtcMapWidget } from "@/widgets/atc-map";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useMapLoader } from "@/features/map-visualizer/model/useMapLoader";
import { useGraphStore } from "@/entities/map/model/store";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";

export function ControllerPage() {
    // --- 1. Map Data Loading (Hook) ---
    // Single source of truth for map data
    const { meta: mapMeta, mapImage } = useMapData('final_map');
    
    // --- 2. Store & Local State ---
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
    
    // --- DATA SOURCE CONTROL ---
    const USE_REAL_DATA = true;
    
    // 3. Logic Hooks
    useMapLoader(); 
    // useTelemetrySocket is now managed by SocketBridge globally
    // useMapSync(USE_REAL_DATA); 
    
    // 4. Handlers
    // Map dimension handling moved to widgets/atc-map

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
