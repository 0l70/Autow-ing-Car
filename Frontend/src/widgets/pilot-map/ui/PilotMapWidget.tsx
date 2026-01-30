
import { useState, useCallback, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from "@/shared/ui/Card";
import { MapCanvas } from "@/widgets/map-panel/MapCanvas";
import { GraphInteractionLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";

interface PilotMapWidgetProps {
    className?: string;
    onAircraftSelect?: (aircraft: Aircraft | null) => void;
}

export function PilotMapWidget({ className, onAircraftSelect }: PilotMapWidgetProps) {
    // --- Map State ---
    const { mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
    const [mapHeight, setMapHeight] = useState(0);

    const handleMapLoad = useCallback((info: { meta: MapMeta; width: number; height: number }) => {
        setMapMeta(info.meta);
        setMapHeight(info.height);
    }, []);

    const gridMetadata = useMemo(() => ({
        width: storeMapWidth || MOCK_MAP_SIZE.width,
        height: storeMapHeight || MOCK_MAP_SIZE.height,
        resolution: 0.05
    }), [storeMapWidth, storeMapHeight]);

    const handleAircraftClick = (ac: Aircraft) => {
        if (onAircraftSelect) {
            onAircraftSelect(ac);
        }
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
                    mapName="pilot_grid"
                    visualStyle="abstract"
                    gridMetadata={gridMetadata}
                    className="w-full h-full"
                    onMapLoad={handleMapLoad}
                    onMapClick={(pos) => console.log("Pilot Map Click:", pos)}
                >
                    <GraphInteractionLayer meta={mapMeta} mapHeight={mapHeight} />
                    <AircraftLayer
                        meta={mapMeta}
                        mapWidth={storeMapWidth || MOCK_MAP_SIZE.width}
                        mapHeight={storeMapHeight || MOCK_MAP_SIZE.height}
                        onAircraftClick={handleAircraftClick}
                    />
                </MapCanvas>
            </div>
        </Card>
    );
}
