import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { Battery, Wifi, Cpu, MapPin } from "lucide-react";
import { Aircraft } from "@/entities/map/model/types";

interface PilotStatusPanelProps {
    aircraft: Aircraft | null;
}

export function PilotStatusPanel({ aircraft }: PilotStatusPanelProps) {
    const displayId = aircraft?.id || 'NO CONNECTION';
    const battery = aircraft?.battery ?? 0;
    const isConnected = !!aircraft;
    

    return (
        <Card className="col-span-3 glass-panel flex flex-col border-white/5 bg-black/20 overflow-hidden">
            <CardHeader className="py-2 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">TUG TELEMETRY</CardTitle>
                    {isConnected && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            <span className="text-[9px] font-bold text-cyan-400/80">LIVE</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-1 px-3 py-3 flex flex-col gap-2">
                {/* 1. Device ID / Callsign Section (Expanded) */}
                <div className="flex-1 flex flex-col justify-center bg-white/5 rounded-lg border border-white/10 p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <Cpu className="w-12 h-12 text-white" />
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Cpu className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">TUG CALLSIGN</span>
                    </div>
                    <div className="text-4xl font-black text-white font-mono tracking-tighter flex items-baseline gap-2 z-10">
                        {displayId}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                        <span className={`text-xs font-bold tracking-widest uppercase ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isConnected ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>

                {/* 2. Grid for Battery & Signal (Expanded) */}
                <div className="flex-[1.5] grid grid-cols-2 gap-2">
                    {/* Battery Widget */}
                    <div className="bg-black/40 rounded-lg border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">BATTERY</span>
                            <Battery className={`w-4 h-4 ${battery > 20 ? 'text-emerald-400' : 'text-red-500'}`} />
                        </div>
                        
                        <div className="flex flex-col gap-1 z-10">
                            <span className={`text-3xl font-black font-mono tracking-tighter ${battery > 20 ? 'text-emerald-400' : 'text-red-500'}`}>
                                {battery}%
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                {battery > 20 ? 'OPTIMAL' : 'LOW POWER'}
                            </span>
                        </div>

                        {/* Visual Bar Background */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
                            <div 
                                className={`h-full transition-all duration-500 ${battery > 20 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                style={{ width: `${battery}%` }}
                            />
                        </div>
                    </div>

                    {/* Signal Widget */}
                    <div className="bg-black/40 rounded-lg border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">LINK</span>
                            <Wifi className="w-4 h-4 text-cyan-400" />
                        </div>
                        
                        <div className="flex flex-col z-10 truncate">
                            <span className="text-xl lg:text-2xl font-black font-mono tracking-tighter text-cyan-400 truncate">
                                {isConnected? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>

                         {/* Visual Bar Background */}
                         <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
                            <div className="h-full bg-cyan-500" style={{ width: '85%' }} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
