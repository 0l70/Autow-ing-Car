import { useEffect, useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { MapCanvas } from "@/widgets/map-panel/MapCanvas";
import { GraphInteractionLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_EDGES, MOCK_NODES, MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";
import { useMockAircraftMqtt } from "@/entities/map/lib/mockAircraft";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { PilotDashboard } from "@/features/dashboard/PilotDashboard";

export function DashboardPage() {
    // 🔐 AUTH GUARD
    const { isAuthenticated, user } = useAuthStore();

    const { loadGraph, setAircrafts } = useGraphStore();
    const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
    const [mapHeight, setMapHeight] = useState(0);
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
    
    // --- DATA SOURCE CONTROL ---
    const USE_REAL_DATA = true; // Toggle this to true to use WebSocket URL
    
    // 1. Real WebSocket (Only connects if authenticated inside hook)
    useTelemetrySocket(undefined, USE_REAL_DATA);
    
    // 2. Mock Data (Fallback)
    const mockData = useMockAircraftMqtt();
    
    useEffect(() => {
        if (!USE_REAL_DATA) {
            setAircrafts(mockData);
        }
    }, [mockData, setAircrafts]); // Only update store from mock if Real Data is OFF
    // ---------------------------

    // Initial Data Load (Simulate Fetch from Edge)
    useEffect(() => {
        loadGraph(MOCK_NODES, MOCK_EDGES);
    }, [loadGraph]);

    // UseCallback to prevent infinite re-rendering loop in MapCanvas
    const handleMapLoad = useCallback((info: { meta: MapMeta; width: number; height: number }) => {
        setMapMeta(info.meta);
        setMapHeight(info.height);
    }, []);

    const gridMetadata = useMemo(() => ({
        width: MOCK_MAP_SIZE.width,
        height: MOCK_MAP_SIZE.height,
        resolution: 0.05
    }), []);

    // 🔐 AUTH GUARD CHECK
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    // ✈️ ROLE-BASED DYNAMIC RENDERING
    if (user?.role === 'PILOT') {
        return <PilotDashboard />;
    }

    // 📡 ATC CONTROLLER VIEW (Default)
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
                    mapHeight={mapHeight} 
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
