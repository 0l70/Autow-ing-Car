import { Gauge, Navigation, MapPin, Signal, Battery } from "lucide-react";
import { useMissionStore } from "@/entities/mission";
import { useAircraftStore } from "@/entities/aircraft";
import { useDerivedMetrics } from "@/features/pilot-actions/model/hooks/useDerivedMetrics";
import { msToKmh } from "@/shared/lib/math";

interface MissionInspectorProps {
    selectedAircraftId: string | null;
}

export function MissionInspector({ selectedAircraftId }: MissionInspectorProps) {
    const activeMissions = useMissionStore(state => state.activeMissions);
    const selectedAircraft = useAircraftStore(state => 
        state.aircrafts.find(a => a.id === selectedAircraftId) ?? null
    );

    // [New] Real-time Euclidean Metrics
    const { calcSpeed } = useDerivedMetrics(selectedAircraft);

    if (!selectedAircraft) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono border border-white/5 rounded-xl p-4 bg-black/20">
                NO SELECTION
            </div>
        );
    }

    const { id, status, battery, isLoaded, position } = selectedAircraft;
    const missionInfo = activeMissions[id];

    
    // Degrees (Stored in position.r)
    const normalizedHeading = Math.round(position.r);

    return (
        <div className="h-full flex flex-col gap-4 min-h-0">
            {/* Header: Flight Context (Primary) */}
            <div className="glass-panel rounded-xl p-5 flex flex-col shrink-0 border-accent-orange/40 shadow-[0_0_15px_rgba(255,120,0,0.15)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-accent-orange/10 blur-2xl -mr-10 -mt-10 pointer-events-none" />
                
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider flex items-center gap-2">
                        {isLoaded ? <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(0,255,0,0.8)]" /> :
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />}
                        {isLoaded ? "LINKED OPERATION" : "IDLE / STANDBY"}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-accent-orange/30 text-accent-orange bg-accent-orange/10">
                        {status}
                    </span>
                </div>
                
                {/* Main Identity */}
                <h2 className="text-4xl font-black text-white mb-1 tracking-tight drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">
                    {missionInfo?.flightNumber || "NO FLIGHT"}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-400 font-mono mb-6">
                    <span>w/ {id}</span>
                    {missionInfo?.destNode && (
                        <>
                            <span>→</span>
                            <span className="text-accent-cyan font-bold">{missionInfo.destNode}</span>
                        </>
                    )}
                </div>

                {/* Alerts (Management by Exception) */}
                <div className="space-y-2">
                     {battery < 20 && (
                        <div className="bg-red-500/20 border border-red-500 text-red-500 text-xs font-bold px-3 py-2 rounded flex items-center animate-pulse">
                            <Battery className="w-4 h-4 mr-2" />
                            LOW BATTERY ({battery}%) - RTB REQUIRED
                        </div>
                     )}
                     {status === 'ERROR' && (
                        <div className="bg-red-500/20 border border-red-500 text-red-500 text-xs font-bold px-3 py-2 rounded flex items-center">
                            <Signal className="w-4 h-4 mr-2" />
                            CONNECTION LOST
                        </div>
                     )}
                </div>
            </div>

            {/* Body: Mission Context & Diagnostics (V5 - Safe Layout) */}
            <div className="flex-1 min-h-[140px] flex flex-col gap-4">
                <div className="flex-1 glass-panel p-5 flex flex-col justify-between bg-white/5 border-white/5">
                    {/* Top: Compact Diagnostics Row */}
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        {/* Battery Compact */}
                        <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                                <Battery className="w-3 h-3" />
                                <span>BATTERY</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${battery < 20 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${battery}%` }} 
                                    />
                                </div>
                                <span className={`text-xs font-mono font-bold ${battery < 20 ? 'text-red-500' : 'text-emerald-400'}`}>
                                    {battery}%
                                </span>
                             </div>
                        </div>

                        {/* Signal Compact */}
                        <div className="flex items-center gap-2">
                            <Signal className="w-3 h-3 text-gray-500" />
                            <div className="flex gap-0.5 items-end h-3">
                                {[1, 2, 3, 4, 5].map((bar) => (
                                    <div 
                                        key={bar} 
                                        className={`w-1 rounded-sm ${bar <= 4 ? 'bg-cyan-500' : 'bg-gray-800'}`}
                                        style={{ height: `${bar * 20}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Linear Mission Progress */}
                    <div className="mt-2">
                         <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-3 px-1">
                            {["READY", "LINK", "TOW", "RTB"].map((step, idx) => {
                                // Simple mapping for demo
                                const currentStepIdx = 
                                    (status === 'IDLE' || status === 'STOP') ? 0 :
                                    (status === 'MOVING_TO_GATE' || status === 'DOCKING') ? 1 :
                                    (status === 'TOWING' || status === 'UNDOCKING') ? 2 :
                                    (status === 'RETURNING' || status === 'WAITING_FOR_RETURN') ? 3 : 0;
                                
                                const isActive = idx === currentStepIdx;
                                const isPast = idx < currentStepIdx;

                                return (
                                    <span key={step} className={`${isActive ? 'text-accent-orange' : isPast ? 'text-white' : ''}`}>
                                        {step}
                                    </span>
                                );
                            })}
                        </div>
                        
                        {/* Progress Line */}
                        <div className="relative h-1 bg-gray-800 rounded-full">
                            {/* Fill */}
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-accent-orange transition-all duration-500"
                                style={{ 
                                    width: `${((
                                        (status === 'IDLE' || status === 'STOP') ? 0 :
                                        (status === 'MOVING_TO_GATE' || status === 'DOCKING') ? 1 :
                                        (status === 'TOWING' || status === 'UNDOCKING') ? 2 :
                                        (status === 'RETURNING' || status === 'WAITING_FOR_RETURN') ? 3 : 0
                                    ) / 3) * 100}%` 
                                }} 
                            />
                            
                            {/* Dots */}
                            {[0, 1, 2, 3].map((step) => {
                                const currentStepIdx = 
                                    (status === 'IDLE' || status === 'STOP') ? 0 :
                                    (status === 'MOVING_TO_GATE' || status === 'DOCKING') ? 1 :
                                    (status === 'TOWING' || status === 'UNDOCKING') ? 2 :
                                    (status === 'RETURNING' || status === 'WAITING_FOR_RETURN') ? 3 : 0;
                                
                                const isActive = step === currentStepIdx;
                                const isPast = step < currentStepIdx;

                                return (
                                    <div 
                                        key={step}
                                        className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-gray-900 transition-all ${
                                            isActive ? 'bg-white ring-2 ring-accent-orange scale-125' : 
                                            isPast ? 'bg-accent-orange' : 'bg-gray-700'
                                        }`}
                                        style={{ left: `${(step / 3) * 100}%` }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: Telemetry Grid (Dense & Technical) */}
            <div className="grid grid-cols-2 grid-rows-[1fr_auto] gap-4 shrink-0 h-48">
                {/* SPEED */}
                <div className="relative p-5 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] flex flex-col justify-between h-full group hover:border-white/20 transition-colors">
                    <div className="flex items-center justify-between text-gray-500">
                        <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-wider uppercase">GS (km/h)</span>
                        </div>
                        {isLoaded && <span className="text-[10px] font-mono text-accent-cyan">AUTO</span>}
                    </div>
                    
                    <div className="flex flex-col mt-auto">
                         <div className="flex items-baseline gap-2">
                             <span className="text-4xl font-mono font-bold text-white tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                                {msToKmh(calcSpeed).toFixed(1)}
                             </span>
                             <span className="text-xs font-mono text-gray-500 mb-1">
                                / TGT 15.0
                             </span>
                         </div>
                         {/* Visual Bar for Speed */}
                         <div className="w-full h-1 bg-gray-700 mt-2 rounded-full overflow-hidden">
                            <div className="h-full bg-white transition-all duration-300" style={{ width: `${Math.min((msToKmh(calcSpeed)) / 20 * 100, 100)}%` }} />
                         </div>
                    </div>
                </div>

                {/* HEADING */}
                <div className="relative p-5 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] flex flex-col justify-between h-full group hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Navigation className="w-4 h-4" />
                        <span className="text-xs font-bold tracking-wider uppercase">HDG</span>
                    </div>

                    <div className="flex flex-col mt-auto">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-mono font-bold text-accent-cyan tracking-tighter drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                                {normalizedHeading.toString().padStart(3, '0')}°
                            </span>
                            <span className="text-xs font-mono text-gray-500 mb-1">
                                MAG
                            </span>
                        </div>
                        {/* Visual Compass Strip */}
                        <div className="w-full h-1.5 bg-gray-800 mt-2 rounded-sm relative overflow-hidden flex items-center justify-center">
                            <div className="w-0.5 h-full bg-accent-cyan" /> {/* Center Marker */}
                            {/* Moving Strip (Mock) */}
                            <div 
                                className="absolute top-0 bottom-0 w-full flex justify-between px-1 opacity-30"
                                style={{ transform: `translateX(${-((normalizedHeading % 90) / 90) * 10}px)` }}
                            >
                                <div className="w-[1px] h-full bg-white" />
                                <div className="w-[1px] h-full bg-white" />
                                <div className="w-[1px] h-full bg-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* LOCATION */}
                <div className="col-span-2 relative p-4 rounded-xl border border-gray-600/30 bg-[hsl(var(--bg-tertiary)_/_0.2)] flex items-center justify-between h-16">
                    <div className="flex items-center gap-3 text-gray-600">
                        <MapPin className="w-4 h-4 opacity-50" />
                        <span className="text-xs font-bold tracking-wider uppercase">LOCATION</span>
                    </div>
                    <div className="flex gap-4 text-lg font-mono text-white/90 font-bold tracking-tight">
                        <div className="flex gap-2">
                            <span className="text-gray-500 text-sm align-super">X</span>
                            {position.x.toFixed(2)}
                        </div>
                        <div className="w-px bg-gray-700 mx-1" />
                        <div className="flex gap-2">
                             <span className="text-gray-500 text-sm align-super">Y</span>
                            {position.y.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
