import { cn } from "@/shared/lib/utils";
import { Gauge, Navigation, MapPin, Signal, Battery } from "lucide-react";
import { Aircraft } from "@/entities/map/model/types";

interface MissionInspectorProps {
    selectedAircraft: Aircraft | null;
}

export function MissionInspector({ selectedAircraft }: MissionInspectorProps) {
    if (!selectedAircraft) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono border border-white/5 rounded-xl p-4 bg-black/20">
                NO AIRCRAFT SELECTED
            </div>
        );
    }

    const { callsign, id, status, speed, position, battery, currentMission } = selectedAircraft;
    
    // Degrees from Radians
    const headingDeg = Math.round((position.r * 180) / Math.PI);
    const normalizedHeading = (headingDeg + 360) % 360; // 0-360

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
        {/* Selected Mission Card - ORANGE NEON */}
        <div className="glass-panel rounded-xl p-5 flex flex-col shrink-0 border-accent-orange/40 shadow-[0_0_15px_rgba(255,120,0,0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-accent-orange/10 blur-2xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] uppercase text-accent-orange font-bold tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_5px_rgba(255,120,0,1)]" />
                    Selected Asset
                </span>
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded border animate-pulse shadow-[0_0_8px_rgba(255,120,0,0.3)]",
                    status === 'MOVING' ? "text-accent-orange bg-accent-orange/10 border-accent-orange/30" :
                    status === 'IDLE' ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" :
                    "text-gray-400 bg-gray-400/10 border-gray-400/30"
                )}>
                    {status}
                </span>
            </div>
            
            <h2 className="text-2xl font-black text-white mb-6 tracking-tight drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">
                {currentMission || "NO MISSION"}
            </h2>
            
            <div className="space-y-3 text-sm mb-6 relative z-10">
                <div className="flex justify-between items-center border-b border-[hsl(var(--gray-600)_/_0.3)] pb-2 group">
                    <span className="text-gray-400 text-xs">Callsign</span>
                    <span className="text-white font-mono group-hover:text-accent-orange transition-colors">{callsign}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[hsl(var(--gray-600)_/_0.3)] pb-2 group">
                    <span className="text-gray-400 text-xs">Vehicle ID</span>
                    <span className="text-white font-mono group-hover:text-accent-orange transition-colors">{id}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[hsl(var(--gray-600)_/_0.3)] pb-2 group">
                    <span className="text-gray-400 text-xs">Battery</span>
                    <span className={cn("font-mono text-xs flex items-center gap-2", battery < 20 ? "text-red-500" : "text-accent-cyan")}>
                        <Battery className="w-3 h-3" /> {battery}%
                    </span>
                </div>
            </div>

            <div className="mt-auto relative z-10">
                 <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400 font-bold">Progress</span>
                    <span className="text-accent-orange font-mono">--%</span>
                </div>
                <div className="h-1.5 w-full bg-[hsl(var(--bg-tertiary))] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-accent-orange w-[0%] shadow-[0_0_10px_rgba(255,120,0,0.8)] relative">
                    </div>
                </div>
            </div>
        </div>

        {/* Connection Section Card - LIME NEON */}
        <div className="glass-panel rounded-xl p-5 flex-1 flex flex-col min-h-0 border-accent-lime/30 shadow-[0_0_15px_rgba(0,255,0,0.1)] relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-lime/50 to-transparent opacity-50" />
             
             <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-lime opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-lime shadow-[0_0_8px_#0f0]"></span>
                    </span>
                    CONNECTION
                </h3>
                <span className="text-[10px] font-mono text-accent-lime bg-accent-lime/10 px-1.5 py-0.5 rounded border border-accent-lime/20 shadow-[0_0_5px_rgba(0,255,0,0.2)]">ONLINE</span>
            </div>

            {/* LIVE CAMERA FEED (WebRTC Placeholder) */}
            <div className="relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-accent-lime/30 mb-4 shrink-0 shadow-[0_0_10px_rgba(0,255,0,0.1)] group">
                <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(0,255,0,0.05)_50%,transparent_75%)] bg-[length:10px_10px]" />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                     <span className="text-accent-lime/50 text-xs font-mono animate-pulse">NO SIGNAL</span>
                </div>
                <div className="absolute top-2 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white border border-white/10 uppercase font-mono">
                    CAM-01
                </div>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
                {/* SPEED */}
                <div className="relative p-3 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] overflow-hidden">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Gauge className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">SPEED</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-mono font-bold text-accent-orange drop-shadow-[0_0_8px_rgba(255,120,0,0.4)]">
                            {speed.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500 font-bold">m/s</span>
                    </div>
                </div>

                {/* HEADING */}
                <div className="relative p-3 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] overflow-hidden">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Navigation className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">HEADING</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-mono font-bold text-accent-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                            {normalizedHeading}
                        </span>
                        <span className="text-xs text-gray-500 font-bold">°</span>
                    </div>
                </div>
            </div>
            
            {/* POSITION Grid */}
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                  {/* POS X */}
                  <div className="relative p-3 rounded-xl border border-gray-600/30 bg-[hsl(var(--bg-tertiary)_/_0.2)] flex flex-col justify-end min-h-[80px]">
                    <div className="flex items-center gap-2 text-gray-600 mb-auto">
                        <MapPin className="w-3 h-3 opacity-50" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">POS X</span>
                    </div>
                    <div className="text-xl font-mono text-white/90 font-bold tracking-tight">
                        {position.x.toFixed(2)}
                    </div>
                </div>

                {/* POS Y */}
                <div className="relative p-3 rounded-xl border border-gray-600/30 bg-[hsl(var(--bg-tertiary)_/_0.2)] flex flex-col justify-end min-h-[80px]">
                    <div className="flex items-center gap-2 text-gray-600 mb-auto">
                        <MapPin className="w-3 h-3 opacity-50" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">POS Y</span>
                    </div>
                    <div className="text-xl font-mono text-white/90 font-bold tracking-tight">
                        {position.y.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
