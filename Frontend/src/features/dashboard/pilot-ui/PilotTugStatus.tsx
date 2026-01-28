import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { Battery, Signal } from "lucide-react";
import { VEHICLE_STATUS } from "@/features/dashboard/MockData";

export function PilotTugStatus() {
    return (
        <Card className="col-span-3 glass-panel flex flex-col">
            <CardHeader className="py-2 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400">TUG STATUS</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 flex flex-col justify-center gap-3">
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 text-xs font-bold tracking-wider">TUG ID</span>
                    <span className="text-lg font-bold text-slate-200 font-mono tracking-wide">{VEHICLE_STATUS.id}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 flex items-center gap-2 text-xs font-bold tracking-wider">
                        <Battery className="w-3 h-3" /> BATTERY
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono ${VEHICLE_STATUS.battery > 20 ? 'text-green-400' : 'text-red-500'}`}>
                            {VEHICLE_STATUS.battery}%
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/10">
                    <span className="text-slate-500 flex items-center gap-2 text-xs font-bold tracking-wider">
                        <Signal className="w-3 h-3" /> SIGNAL
                    </span>
                    <span className="text-cyan-400 text-xs font-bold font-mono tracking-wide">{VEHICLE_STATUS.signal}</span>
                </div>
            </CardContent>
        </Card>
    );
}
