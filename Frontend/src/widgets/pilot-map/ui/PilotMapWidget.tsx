import { useState, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { useAircraftStore } from "@/entities/aircraft"; 
import { useMissionStore } from "@/entities/mission";

// FSD 레이어
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { DestinationLayer } from "@/features/map-visualizer/ui/DestinationLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useGridMetadata } from "@/features/map-visualizer/model/useGridMetadata"; 
import { useAutoViewport } from "@/features/map-visualizer/model/useAutoViewport";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

interface PilotMapWidgetProps {
    className?: string;
    assignedCarId?: string | null | undefined; 
    onAircraftSelect?: ((aircraft: Aircraft | null) => void) | undefined;
}

export function PilotMapWidget({ className, assignedCarId, onAircraftSelect }: PilotMapWidgetProps) {
    // 1. 데이터 레이어
    const { meta, mapImage } = useMapData();
    const { nodes } = useGraphStore(); 
    
    const allAircrafts = useAircraftStore(state => state.aircrafts);

    // 2. 로직 레이어
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // 그리드 및 치수
    const { gridMetadata: rawGridMetadata } = useGridMetadata();

    // [Update] 1.2x Grid Expansion Logic (Matching ATC Map)
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

    // 뷰포트 로직
    const { viewBox: autoViewBox } = useAutoViewport(
        nodes,
        paddedGridMetadata as any,
        paddedGridMetadata.height,
        paddedGridMetadata.width,
        paddedGridMetadata.height,
        { 
            paddingScale: 0.05, 
            minPadding: 2 
        } // Consistent with ATC
    );
    
    const myAircraftData = useMemo(() => {
        return assignedCarId 
            ? allAircrafts.filter(a => a.id === assignedCarId) 
            : []; 
    }, [allAircrafts, assignedCarId]);

    // [Active Route Extraction]
    const activeRoutePath = useMemo(() => {
        if (!assignedCarId) return undefined;
        const myAircraft = allAircrafts.find(a => a.id === assignedCarId);
        
        // Show path when Connected/Towing or STOP
        const isActiveState = myAircraft?.status === 'TOWING' || myAircraft?.status === 'STOP' || myAircraft?.status === 'MOVING_TO_GATE';
        
        if(!isActiveState) return undefined;

        // Priority 1: Check aircraft.currentMission.path (from WebSocket)
        const missionObj = myAircraft?.currentMission as any;
        if(Array.isArray(missionObj?.path)) {
            return missionObj.path as string[];
        }

        // Priority 2: Check activeMissions[carId].edgeIds (from REST API)
        const activeMissions = useMissionStore.getState().activeMissions;
        const missionInfo = activeMissions[assignedCarId];
        if(Array.isArray(missionInfo?.edgeIds)) {
            return missionInfo.edgeIds;
        }

        return undefined;
    }, [allAircrafts, assignedCarId]);

    // [New] Destination for Pilot
    const destNodeId = useMemo(() => {
        if (!assignedCarId) return undefined;
        // Priority 1: Mission Store (REST/Socket synced)
        const myMission = useMissionStore.getState().activeMissions[assignedCarId];
        return myMission?.destNode;
    }, [assignedCarId, allAircrafts]); // Re-eval when aircrafts update (sync)

    // 3. UI 레이어
    return (
        <Card className={`glass-panel relative overflow-hidden flex flex-col ${className}`}>
            <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-cyan-500" />
                    DIGITAL TWIN NAVIGATION (PILOT)
                </CardTitle>
            </CardHeader>
            <div className="flex-1 relative bg-[#0a0a0f] overflow-hidden">
                    <MapCanvas
                        // 데이터
                        mapImage={mapImage || null}
                        meta={paddedGridMetadata as any} 
                        
                        // 설정
                        visualStyle="abstract"
                        gridMetadata={paddedGridMetadata} 
                        
                        // 렌더 스케일 (Match ATC)
                        pixelRatio={5}
                        
                        // 뷰포트
                        initialViewBox={autoViewBox}
                        maxBounds={autoViewBox} // [Zoom Limit] Restrict to auto-fit bounds
                        
                        // 그리드 옵션 (Match Match ATC)
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
                        <GraphLayer 
                            meta={paddedGridMetadata as any} 
                            mapHeight={activeHeight} 
                            overridePath={activeRoutePath}
                            activePathColor={MAP_CONFIG.GRAPH.COLOR.PILOT_GLOW} 
                            activeNodeColor={MAP_CONFIG.GRAPH.COLOR.PILOT_ACTIVE} // [NEW] Mint/Teal
                            activeNodeBorderColor={MAP_CONFIG.GRAPH.COLOR.PILOT_ACTIVE_BORDER} // [NEW] Dark Teal
                        />
                        
                        <AircraftLayer
                            meta={paddedGridMetadata as any}
                            mapHeight={activeHeight}
                            mapWidth={activeWidth}
                            pixelRatio={5}
                            data={myAircraftData}
                            onAircraftClick={(ac) => onAircraftSelect?.(ac)} 
                        />
                        
                        <DestinationLayer 
                            meta={paddedGridMetadata as any}
                            mapHeight={activeHeight}
                            overrideNodeId={destNodeId} 
                        />
                    </MapCanvas>
            </div>
        </Card>
    );
}
