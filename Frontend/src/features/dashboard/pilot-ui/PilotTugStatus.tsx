import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { Battery, Signal } from "lucide-react";
import { VEHICLE_STATUS } from "@/features/dashboard/MockData";
import { Aircraft } from "@/entities/map/model/types";

interface PilotTugStatusProps {
    aircraft: Aircraft | null;
}

export function PilotTugStatus({ aircraft }: PilotTugStatusProps) {
    // Fallback to Mock Data if no aircraft connected yet
    const displayId = aircraft?.id || VEHICLE_STATUS.id;
    const displayBattery = aircraft?.battery ?? VEHICLE_STATUS.battery; // 0 could be valid
    // Signal strength is not in Aircraft type yet, assume GOOD if connected
    const displaySignal = aircraft ? "EXCELLENT" : "WAITING";

    return (
        <Card className="col-span-3 glass-panel flex flex-col">
            <CardHeader className="py-2 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400">TUG STATUS</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 flex flex-col justify-center gap-3">
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 text-xs font-bold tracking-wider">TUG ID</span>
                    <span className="text-lg font-bold text-slate-200 font-mono tracking-wide">{displayId}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 flex items-center gap-2 text-xs font-bold tracking-wider">
                        <Battery className="w-3 h-3" /> BATTERY
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono ${displayBattery > 20 ? 'text-green-400' : 'text-red-500'}`}>
                            {displayBattery}%
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 flex items-center gap-2 text-xs font-bold tracking-wider">
                        <Signal className="w-3 h-3" /> SIGNAL
                    </span>
                    <span className="text-cyan-400 text-xs font-bold font-mono tracking-wide">{displaySignal}</span>
                </div>
            </CardContent>
        </Card>
    );
}
