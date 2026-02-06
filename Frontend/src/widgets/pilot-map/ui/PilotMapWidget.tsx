import { useState, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { useAircraftStore } from "@/entities/aircraft"; 

// FSD Layers
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";
import { useGridMetadata } from "@/features/map-visualizer/model/useGridMetadata"; 
import { useAutoViewport } from "@/features/map-visualizer/model/useAutoViewport"; 

interface PilotMapWidgetProps {
    className?: string;
    assignedCarId?: string | null | undefined; 
    onAircraftSelect?: ((aircraft: Aircraft | null) => void) | undefined;
}

export function PilotMapWidget({ className, assignedCarId, onAircraftSelect }: PilotMapWidgetProps) {
    // 1. Data Layer
    const { meta, mapImage } = useMapData();
    const { nodes } = useGraphStore(); 
    
    const allAircrafts = useAircraftStore(state => state.aircrafts);

    // 2. Logic Layer
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // Grid & Dimensions
    const { gridMetadata: rawGridMetadata } = useGridMetadata();

    // --- HIGH RESOLUTION SCALING (VIRTUAL MAP) ---
    // User requested Resolution 0.01 (High Res)
    // Current Raw: 0.05.
    // Scale Factor = 0.05 / 0.01 = 5.
    
    const virtualMetadata = useMemo(() => {
        const SCALE_FACTOR = 5; // 5x Resolution
        
        // Logical Dimensions (World Pixels)
        const baseW = rawGridMetadata.width * SCALE_FACTOR;
        const baseH = rawGridMetadata.height * SCALE_FACTOR;
        
        // Resolution (Meters per Pixel)
        const baseRes = rawGridMetadata.resolution / SCALE_FACTOR; // 0.05 -> 0.01
        
        // Padded Logic (Virtual Expansion for aesthetics)
        const expansionRatio = 0.2; 
        const sideRatio = 0.1;      

        const extraW = baseW * expansionRatio;
        const extraH = baseH * expansionRatio;

        const newWidth = baseW + extraW;
        const newHeight = baseH + extraH;

        const padX_Meters = (baseW * sideRatio) * baseRes;
        const padY_Meters = (baseH * sideRatio) * baseRes;

        const baseOrigin = rawGridMetadata.origin || [0,0,0];
        
        return {
            ...rawGridMetadata,
            width: newWidth,
            height: newHeight,
            resolution: baseRes, // 0.01
            origin: [
                baseOrigin[0] - padX_Meters,
                baseOrigin[1] - padY_Meters,
                baseOrigin[2]
            ]
        };
    }, [rawGridMetadata]);

    // Viewport    // 뷰포트 로직
    // [수정] useAutoViewport를 사용하여 모든 노드가 포함되도록 초기 뷰포트 계산
    // virtualMetadata(5x)를 기준으로 계산하여 고해상도 좌표계와 일치시킴
    const { viewBox: autoViewBox } = useAutoViewport(
        nodes,
        virtualMetadata as any,
        virtualMetadata.height,
        virtualMetadata.width,
        virtualMetadata.height,
        { paddingScale: 0.05, minPadding: 2 } // 여유 공간 설정
    );

    // 새로운 MapCanvas는 카메라 시스템을 사용하므로,
    // 'initialViewBox'나 'maxBounds'를 전달하여 포커스를 맞춥니다.
    
    const myAircraftData = useMemo(() => {
        return assignedCarId 
            ? allAircrafts.filter(a => a.id === assignedCarId) 
            : []; 
    }, [allAircrafts, assignedCarId]);

    const activeHeight = virtualMetadata.height;

    // 3. UI Layer
    return (
        <Card className={`glass-panel relative overflow-hidden flex flex-col ${className}`}>
            <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-cyan-500" />
                    DIGITAL TWIN NAVIGATION (HIGH-RES)
                </CardTitle>
            </CardHeader>
            <div className="flex-1 relative bg-black/40 overflow-hidden">
                    <MapCanvas
                        // Data
                        mapImage={mapImage || null}
                        meta={virtualMetadata as any} 
                        
                        // Config
                        visualStyle="abstract"
                        gridMetadata={virtualMetadata} 
                        
                        // 렌더 스케일
                        pixelRatio={window.devicePixelRatio || 1}
                        
                        // 뷰포트
                        // 자동 계산된 뷰박스를 초기 포커스로 사용
                        initialViewBox={autoViewBox}
                        // 가상 치수를 경계로 사용 (드래그 제한)
                        maxBounds={{ x: 0, y: 0, width: virtualMetadata.width, height: virtualMetadata.height }}
                        
                        // 그리드 옵션 (미터는 동일하지만 시각적 선 조절이 필요할 수 있음)
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
                        <GraphLayer meta={virtualMetadata as any} mapHeight={activeHeight} />
                        
                        <AircraftLayer
                            meta={virtualMetadata as any}
                            mapHeight={activeHeight} // Logical Height
                            mapWidth={virtualMetadata.width} // Logical Width (Unused by Canvas sizing but maybe useful)
                            
                            pixelRatio={window.devicePixelRatio || 1} // Sharpness
                            data={myAircraftData}
                            onAircraftClick={(ac) => onAircraftSelect?.(ac)} 
                        />
                    </MapCanvas>
            </div>
        </Card>
    );
}
