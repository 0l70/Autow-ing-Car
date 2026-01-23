import { MousePointer2, CircleDot, Waypoints } from "lucide-react";
import { useGraphStore } from "@/entities/map/model/store";

export function EditorToolbar() {
    const { interactionMode, setMode } = useGraphStore();

    return (
        <div className="absolute top-24 left-6 flex flex-col gap-2 z-30">
            <div className="bg-black/90 backdrop-blur border border-white/10 p-1 rounded-lg flex flex-col gap-1 shadow-xl">
                
                <button
                    onClick={() => setMode('SELECT')}
                    className={`p-3 rounded-md transition-all ${
                        interactionMode === 'SELECT' 
                        ? 'bg-accent-cyan text-black shadow-[0_0_10px_rgba(0,255,255,0.4)]' 
                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Select Mode (V)"
                >
                    <MousePointer2 className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setMode('NODE')}
                    className={`p-3 rounded-md transition-all ${
                        interactionMode === 'NODE' 
                        ? 'bg-accent-orange text-black shadow-[0_0_10px_rgba(255,165,0,0.4)]' 
                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Add Node (N)"
                >
                    <CircleDot className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setMode('EDGE')}
                    className={`p-3 rounded-md transition-all ${
                        interactionMode === 'EDGE' 
                        ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(0,255,0,0.4)]' 
                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Add Edge (E)"
                >
                    <Waypoints className="w-5 h-5" />
                </button>

            </div>
            
            <div className="bg-black/80 text-[10px] text-gray-500 px-2 py-1 rounded border border-white/5 text-center">
                MODE: {interactionMode}
            </div>
        </div>
    );
}
