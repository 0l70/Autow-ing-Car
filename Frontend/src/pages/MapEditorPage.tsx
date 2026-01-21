import { MapCanvas } from "@/widgets/map-panel/MapCanvas";

export function MapEditorPage() {
    return (
        <div className="relative w-screen h-screen bg-[#050505] overflow-hidden">
            
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

            {/* Map Canvas (Editor Mode) */}
            <MapCanvas 
                mapName="airport_map1"
                className="w-full h-full"
                onMapClick={(pos) => {
                    console.log(`[Editor] New Node Position: ${pos.x}, ${pos.y}`);
                    // TODO: Open "Create Node" Modal here
                }}
            />

            {/* Editor Toolbar (Placeholder) */}
            <div className="absolute top-24 left-6 flex flex-col gap-2 pointer-events-none">
                 <div className="bg-black/80 backdrop-blur border border-accent-orange/30 p-4 rounded-lg shadow-lg">
                    <h2 className="text-accent-orange font-bold text-sm mb-2">EDITOR TOOLS</h2>
                    <div className="text-gray-400 text-xs">
                        <p>1. Click on map to add Node</p>
                        <p>2. Drag between nodes to link</p>
                    </div>
                 </div>
            </div>

        </div>
    );
}
