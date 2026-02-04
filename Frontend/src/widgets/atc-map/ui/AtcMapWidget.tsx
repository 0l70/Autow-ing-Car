import { useState, useMemo } from 'react';
import { Map as MapIcon, Maximize2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { useGraphStore } from "@/entities/map/model/store";
import { Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";

// Shared Map Visualizer Components
import { MapCanvas } from "@/features/map-visualizer/ui/MapCanvas";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useMapData } from "@/features/map-visualizer/model/useMapData";

interface AtcMapWidgetProps {
    className?: string;
    // ATC sees ALL aircrafts, so we might pass them as props or use a global store hook inside
    // For now, let's assume we use the same hook but it returns all data in a real app
    // or we pass additional data props if needed.
}

export function AtcMapWidget({ className }: AtcMapWidgetProps) {
    // --- Data Loading ---
    const { meta, mapImage, dimensions } = useMapData(); // Use a distinct key or same if shared
    
    // --- Store State ---
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight, mapMeta: storeMeta } = useGraphStore();

    // Map Load Handler
    const [loadedDims, setLoadedDims] = useState({ width: 0, height: 0 });
    
    // Grid Metadata
    const gridMetadata = useMemo(() => {
        // [Update] Always prefer resolution and origin from local YAML (meta)
        const effectiveMeta = meta || storeMeta;
        const resolution = effectiveMeta?.resolution || 0.05;
        
        // [Fix] Prioritize Backend Dimensions (from useMapData/mapInfo) -> Store -> Schema -> Mock
        const logicalWidth = dimensions?.width || storeMapWidth || MOCK_MAP_SIZE.width;
        const logicalHeight = dimensions?.height || storeMapHeight || MOCK_MAP_SIZE.height;

        return {
            width: logicalWidth,
            height: logicalHeight,
            resolution
        };
    }, [storeMapWidth, storeMapHeight, meta, dimensions]);

    // Dimensions to use
    // If we have an image, use its real pixels. Otherwise use store/mock.
    const activeWidth = loadedDims.width || gridMetadata.width;
    const activeHeight = loadedDims.height || gridMetadata.height;

    // ATC View: Full Map by default (Dynamic)
    // Map Size: Based on loaded metadata
    const fullMapView = useMemo(() => {
        return {
            x: 0,
            y: 0,
            width: gridMetadata.width,
            height: gridMetadata.height
        };
    }, [gridMetadata]);

    const handleAircraftClick = (ac: Aircraft) => {
        console.log("ATC Selected Aircraft:", ac.id);
        // TODO: Open detailed control modal for ATC
    };

    return (
        <Card className={`glass-panel relative overflow-hidden flex flex-col ${className}`}>
            <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur justify-between flex-row items-center">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-500" /> {/* Emerald for ATC/Ground */}
                    GROUND TRAFFIC CONTROL
                </CardTitle>
                <button className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors">
                    <Maximize2 className="w-3 h-3" />
                    Expand
                </button>
            </CardHeader>
            <div className="flex-1 relative bg-[#0a0a0f] overflow-hidden">
                <MapCanvas
                    // Data
                    mapImage={mapImage || null}
                    meta={meta || null}
                    
                    // Config
                    visualStyle="abstract" // [Update] Use 'abstract' style for grid visibility
                    gridMetadata={gridMetadata}
                    pixelRatio={5} 
                    
                    // Viewport Control
                    initialViewBox={fullMapView}
                    // maxBounds={fullMapView}
                    
                    // Grid Customization (Match Pilot Style but adjusted for Full Map scale)
                    // Pilot: 1.5m / 0.5m
                    // ATC: 5.0m / 1.0m (To avoid too much density on full map)
                    gridOptions={{
                        majorInterval: 1.5,  // 1.5m 간격 (주요 격자)
                        minorInterval: 0.5,  // 0.5m 간격 (세부 격자)
                        majorWidth: 0.3,     // 주요 격자 두께
                        minorWidth: 0.1,     // 세부 격자 두께
                        majorColor: 'rgba(0, 255, 255, 0.2)', // 시안색 (은은하게)
                        minorColor: 'rgba(255, 255, 255, 0.3)'  // 흰색 (배경처럼)
                    }}
                    
                    className="w-full h-full"
                    onMapLoad={setLoadedDims}
                    onMapClick={(pos) => console.log("ATC Map Click:", pos)}
                >
                    {/* Render Layers */}
                    <GraphLayer 
                        meta={meta || storeMeta || null} 
                        mapHeight={activeHeight} 
                    />
                    
                    <AircraftLayer
                        meta={meta || storeMeta || null}
                        mapWidth={activeWidth}
                        mapHeight={activeHeight}
                        pixelRatio={5}
                        onAircraftClick={handleAircraftClick}
                    />
                    
                    {/* Future: RadarLayer, ExclusionZonesLayer etc. */}
                </MapCanvas>
            </div>
            
            {/* Overlay Status Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/60 backdrop-blur border-t border-white/5 flex items-center px-4 text-[10px] text-white/40 gap-4">
                <span>ZOOM: 100%</span>
                <span>LAT/LON: 36.123, 128.456</span>
                <span className="ml-auto text-emerald-400/80">LIVE UPDATES ACTIVE</span>
            </div>
        </Card>
    );
}
