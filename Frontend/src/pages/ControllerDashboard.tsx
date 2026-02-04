import { useState } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { AtcMapWidget } from "@/widgets/atc-map";
import { useMapData } from "@/features/map-visualizer/model/useMapData";

export function ControllerDashboard() {
    // --- 1. Map Data Loading (Hook) ---
    // Single source of truth for map data
    useMapData();
    
    // --- 2. Store & Local State ---
    const [selectedAircraftId] = useState<string | null>(null);
    
    // --- 3. Handlers ---
    // Map dimension handling moved to widgets/atc-map



    // 4. Render
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
