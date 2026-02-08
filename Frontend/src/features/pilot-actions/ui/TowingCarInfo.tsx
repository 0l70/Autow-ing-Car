import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
// import { NAVIGATION_DATA } from "@/features/dashboard/MockData";
import { MoveState } from "../model/types";
import { Aircraft } from "@/entities/map/model/types";
import { useDerivedMetrics } from "../model/hooks/useDerivedMetrics";

interface TowingCarInfoProps {
    moveState: MoveState;
    aircraft: Aircraft | null;
}

export function TowingCarInfo({ aircraft }: Omit<TowingCarInfoProps, 'moveState'>) {
    // 1. Get Metrics from Domain Hook
    const { destination } = useDerivedMetrics(aircraft);

    // 2. Format Data for Display
    // [Updated] Match Controller Logic: Use direct telemetry speed converted to Knots
    const rawSpeed = aircraft?.speed ?? 0;
    const speedKts = (rawSpeed * 1.94384).toFixed(0); 
    
    const headingDeg = aircraft ? Math.round(aircraft.position.r) : 0;

    return (
        <Card className="col-span-5 glass-panel flex flex-col">
            <CardHeader className="py-2 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400">NAVIGATION DATA</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 grid grid-cols-2 gap-4 items-center">
                <div className="bg-black/40 p-4 rounded border border-white/10 h-full flex flex-col justify-center">
                    <span className="text-slate-500 text-xs font-bold block mb-1 tracking-wider uppercase">Ground Speed</span>
                    <span className="text-4xl font-bold text-slate-200 font-mono tracking-tighter">
                        {speedKts} <span className="text-sm text-slate-500 font-normal">kts</span>
                    </span>
                </div>
                <div className="flex flex-col gap-2 h-full">
                    <div className="bg-black/40 p-2 px-3 rounded border border-white/10 flex justify-between items-center flex-1">
                        <span className="text-slate-500 text-xs font-bold tracking-wider">HEADING</span>
                        <span className="text-xl font-bold text-slate-200 font-mono">{headingDeg}°</span>
                    </div>
                    <div className="bg-black/40 p-2 px-3 rounded border border-white/10 flex justify-between items-center flex-1">
                        <span className="text-slate-500 text-xs font-bold tracking-wider">DESTINATION</span>
                        <span className="text-slate-200 font-bold text-xs font-mono uppercase">{destination}</span>
                    </div>
                </div>
                {/* Mission Progress Steps (Replaces simple bar) */}
                <div className="col-span-2 mt-2">
                     <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-2 px-1">
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
