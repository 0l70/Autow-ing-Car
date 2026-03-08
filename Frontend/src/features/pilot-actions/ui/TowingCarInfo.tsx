import { Navigation, Gauge, MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
// import { NAVIGATION_DATA } from "@/features/dashboard/MockData";
import { MoveState } from "../model/types";
import { Aircraft } from "@/entities/map/model/types";
import { useDerivedMetrics } from "../model/hooks/useDerivedMetrics";
import { msToKmh } from "@/shared/lib/math";

interface TowingCarInfoProps {
    moveState: MoveState;
    aircraft: Aircraft | null;
}

export function TowingCarInfo({ moveState, aircraft }: TowingCarInfoProps) {
    // 1. Get Metrics from Domain Hook
    const { calcSpeed, distRemain, destination } = useDerivedMetrics(aircraft);

    // 2. Format Data for Display
    const speedKmh = msToKmh(calcSpeed).toFixed(1);
    const headingDeg = aircraft ? Math.round(aircraft.position.r) : 0;
    const distText = distRemain !== null ? `${Math.round(distRemain)} m` : "---";

    return (
        <Card className="col-span-5 glass-panel flex flex-col">
            <CardHeader className="py-2 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400">NAVIGATION DATA</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-3 grid grid-cols-2 gap-3 items-center">
                <div className="bg-white/5 p-4 rounded-lg border border-white/5 h-full flex flex-col justify-center relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 blur-2xl -mr-8 -mt-8 pointer-events-none" />
                    
                    <div className="flex items-center gap-2 mb-2">
                        <Gauge className="w-4 h-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
                        <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase">Ground Speed</span>
                    </div>
                    
                    <div className="flex flex-col">
                        <span className="text-3xl font-black text-slate-200 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                            {speedKmh}
                        </span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-9px text-slate-500 font-bold uppercase tracking-widest">km/h</span>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`w-3 h-1 rounded-full ${Number(speedKmh) > i * 5 ? 'bg-amber-500' : 'bg-white/10'}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* 3. Navigation Metrics Grid */}
                <div className="flex flex-col gap-2 h-full">
                    {/* HEADING */}
                    <div className="bg-black/40 px-3 flex-1 rounded border border-white/10 flex justify-between items-center transition-colors hover:border-cyan-500/30">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-500 text-[9px] font-black tracking-wider uppercase">Heading</span>
                        </div>
                        <span className="text-lg font-bold text-slate-200 font-mono italic tracking-tighter">{headingDeg}°</span>
                    </div>

                    {/* COORDINATES */}
                    <div className="bg-black/40 px-3 flex-1 rounded border border-white/10 flex justify-between items-center transition-colors hover:border-cyan-500/30">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-500 text-[9px] font-black tracking-wider uppercase">Position</span>
                        </div>
                        <div className="flex px-3  gap-2 font-mono text-xs font-bold text-slate-300">
                             <div className="flex items-baseline gap-1">
                                <span className="text-[13px] text-slate-600 font-sans uppercase">X</span>
                                <span className="text-[15px]">{aircraft?.position.x.toFixed(1) || '0.0'}</span>
                             </div>
                             <div className="flex items-baseline gap-1">
                                <span className="text-[13px] text-slate-600 font-sans uppercase">Y</span>
                                <span className="text-[15px]">{aircraft?.position.y.toFixed(1) || '0.0'}</span>
                             </div>
                        </div>
                    </div>

                    {/* DESTINATION */}
                    <div className="bg-black/40 px-3 flex-1 rounded border border-white/10 flex justify-between items-center transition-colors hover:border-white/20">
                        <span className="text-slate-500 text-[9px] font-black tracking-wider uppercase">Destination</span>
                        <span className="text-slate-200 font-bold text-[9px] font-mono uppercase bg-white/5 px-2 py-0.5 rounded-sm border border-white/5">{destination}</span>
                    </div>
                </div>
                {/* Mission Progress Steps */}
                <div className="col-span-2 mt-1">
                     <div className="flex justify-between text-[13px] text-gray-500 font-bold mb-1.5 px-1">
                        {["READY", "LINK", "TOW", "RTB"].map((step, idx) => {
                            const status = aircraft?.status || 'IDLE';
                            const currentStepIdx = 
                                (status === 'IDLE' || status === 'STOP') ? 0 :
                                (status === 'MOVING_TO_GATE' || status === 'DOCKING') ? 1 :
                                (status === 'TOWING' || status === 'UNDOCKING') ? 2 :
                                (status === 'RETURNING' || status === 'WAITING_FOR_RETURN') ? 3 : 0;
                            
                            const isActive = idx === currentStepIdx;
                            const isPast = idx < currentStepIdx;

                            return (
                                <span key={step} className={`${isActive ? 'text-amber-500' : isPast ? 'text-white' : ''}`}>
                                    {step}
                                </span>
                            );
                        })}
                    </div>
                    
                    {/* Progress Line */}
                    <div className="relative h-1 bg-slate-800 rounded-full">
                        {/* Fill */}
                        <div 
                            className="absolute left-0 top-0 bottom-0 bg-amber-500 transition-all duration-500"
                            style={{ 
                                width: `${((
                                    (!aircraft || aircraft.status === 'IDLE' || aircraft.status === 'STOP') ? 0 :
                                    (aircraft.status === 'MOVING_TO_GATE' || aircraft.status === 'DOCKING') ? 1 :
                                    (aircraft.status === 'TOWING' || aircraft.status === 'UNDOCKING') ? 2 :
                                    (aircraft.status === 'RETURNING' || aircraft.status === 'WAITING_FOR_RETURN') ? 3 : 0
                                ) / 3) * 100}%` 
                            }} 
                        />
                        
                        {/* Dots */}
                        {[0, 1, 2, 3].map((step) => {
                             const status = aircraft?.status || 'IDLE';
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
                                        isActive ? 'bg-white ring-2 ring-amber-500 scale-125' : 
                                        isPast ? 'bg-amber-500' : 'bg-slate-700'
                                    }`}
                                    style={{ left: `${(step / 3) * 100}%` }}
                                />
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
