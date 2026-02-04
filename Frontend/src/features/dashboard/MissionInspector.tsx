import { Gauge, Navigation, MapPin, Signal, Battery } from "lucide-react";
import { useMissionStore } from "@/entities/mission";
import { useAircraftStore } from "@/entities/aircraft";

interface MissionInspectorProps {
    selectedAircraftId: string | null;
}

export function MissionInspector({ selectedAircraftId }: MissionInspectorProps) {
    const activeMissions = useMissionStore(state => state.activeMissions);
    const selectedAircraft = useAircraftStore(state => 
        state.aircrafts.find(a => a.id === selectedAircraftId) ?? null
    );

    if (!selectedAircraft) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono border border-white/5 rounded-xl p-4 bg-black/20">
                NO SELECTION
            </div>
        );
    }

    const { id, status, speed, position, battery, isLoaded } = selectedAircraft;
    const missionInfo = activeMissions[id]; // Lookup Flight Info
    
    // Degrees from Radians
    const headingDeg = Math.round((position.r * 180) / Math.PI);
    const normalizedHeading = (headingDeg + 360) % 360; // 0-360

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

            {/* Body: Movement Monitoring (Secondary) */}
            <div className="grid grid-cols-2 gap-3 mt-auto">
                {/* SPEED */}
                <div className="relative p-3 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] flex flex-col justify-between h-24">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Gauge className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">GS (kts)</span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] mt-auto">
                        {(speed * 1.94384).toFixed(0)} 
                    </div>
                </div>

                {/* HEADING */}
                <div className="relative p-3 rounded-xl border border-gray-600/50 bg-[hsl(var(--bg-tertiary)_/_0.3)] flex flex-col justify-between h-24">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Navigation className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">HDG</span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-accent-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] mt-auto">
                        {normalizedHeading.toString().padStart(3, '0')}°
                    </div>
                </div>

                {/* LOCATION (Consolidated) */}
                <div className="col-span-2 relative p-3 rounded-xl border border-gray-600/30 bg-[hsl(var(--bg-tertiary)_/_0.2)] flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-3 h-3 opacity-50" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">LOCATION</span>
                    </div>
                    <div className="text-lg font-mono text-white/90 font-bold tracking-tight">
                        X: {position.x.toFixed(0)} <span className="text-gray-600 mx-2">|</span> Y: {position.y.toFixed(0)}
                    </div>
                </div>
            </div>
        </div>
    );
}
