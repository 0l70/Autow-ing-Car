import { useState, useCallback, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";

// Refactored Imports
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer"; // 편집 기능 없는 순수 뷰어
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";

interface PilotMapWidgetProps {
    className?: string;
    onAircraftSelect?: ((aircraft: Aircraft | null) => void) | undefined;
}

export function PilotMapWidget({ className, onAircraftSelect }: PilotMapWidgetProps) {
    // --- Data Loading ---
    // 기존에는 MapCanvas 내부에서 로딩했으나, 이제는 Hook으로 분리되어 위젯이 데이터를 관리합니다.
    const { meta, mapImage } = useMapData('final_map');
    
    // --- Store State ---
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();

    // Map Load Handler (Store Sync or Layout)
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // Grid Metadata for Abstract Mode (Fallback)
    const gridMetadata = useMemo(() => ({
        width: storeMapWidth || MOCK_MAP_SIZE.width,
        height: storeMapHeight || MOCK_MAP_SIZE.height,
        resolution: 0.05
    }), [storeMapWidth, storeMapHeight]);

    // Dimensions to use (Real > Metadata > Mock)
    const activeWidth = loadedDims.width || gridMetadata.width;
    const activeHeight = loadedDims.height || gridMetadata.height;

    // [New] Calculate Lower Half ViewBox (Fixed Crop based on Analysis)
    // Map Size: 327x275
    // Crop: X(82~245), Y(137~275)
    const lowerHalfView = useMemo(() => {
        // If meta not loaded yet, use default crop relative to MOCK size or wait
        // But better to return the calculated values directly as they align with the physical map
        return {
            x: 82,
            y: 137,
            width: 163,
            height: 138
        };
    }, []);

    const handleAircraftClick = (ac: Aircraft) => {
        if (onAircraftSelect) onAircraftSelect(ac);
    };

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
                        mapImage={mapImage || null} // 로딩 중이면 null
                        meta={meta || null}
                        
                        // Config
                        visualStyle="abstract" // 파일럿 뷰는 추상화된 그리드 스타일 선호
                        gridMetadata={gridMetadata}
                        pixelRatio={2}// [Update] 2x High Resolution (Matched with ATC)
                        
                        // [New] Viewport Control
                        initialViewBox={lowerHalfView}
                        maxBounds={lowerHalfView} // Enforce boundaries
                        
                        // [New] Grid Customization
                        gridOptions={{
                            majorInterval: 1.5,  // 1.5m 간격 (주요 격자)
                            minorInterval: 0.5,  // 0.5m 간격 (세부 격자)
                            majorWidth: 0.3,     // 주요 격자 두께
                            minorWidth: 0.1,     // 세부 격자 두께
                            majorColor: 'rgba(0, 255, 255, 0.15)', // 시안색 (은은하게)
                            minorColor: 'rgba(255, 255, 255, 0.2)'  // 흰색 (배경처럼)
                        }}
                        
                        className="w-full h-full"
                        onMapLoad={setLoadedDims}
                        onMapClick={(pos) => console.log("Pilot Map Click:", pos)}
                    >
                        {/* Render Layers */}
                        <GraphLayer meta={meta || null} mapHeight={activeHeight} />
                        
                        <AircraftLayer
                            meta={meta || null}
                            mapWidth={activeWidth}
                            mapHeight={activeHeight}
                            pixelRatio={2} // Synchronize with MapCanvas
                            onAircraftClick={handleAircraftClick}
                        />
                    </MapCanvas>
            </div>
        </Card>
    );
}
