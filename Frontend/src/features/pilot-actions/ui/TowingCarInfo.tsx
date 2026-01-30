import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { NAVIGATION_DATA } from "@/features/dashboard/MockData";
import { MoveState } from "../model/types";
import { Aircraft } from "@/entities/map/model/types";

interface TowingCarInfoProps {
    moveState: MoveState;
    aircraft: Aircraft | null;
}

export function TowingCarInfo({ moveState, aircraft }: TowingCarInfoProps) {
    // Data Calculation
    // Speed: m/s -> km/h
    const speedKmh = aircraft ? (aircraft.speed * 3.6).toFixed(1) : (moveState !== 'stopped' ? '15' : '0');
    
    // Heading: Radian -> Degree (0-360)
    let headingDeg = 0;
    if (aircraft) {
        let deg = aircraft.position.r * (180 / Math.PI);
        if (deg < 0) deg += 360;
        headingDeg = Math.round(deg);
    } else {
        headingDeg = NAVIGATION_DATA.heading;
    }

    // Destination
    const destination = aircraft?.currentMission ? `MISSION #${aircraft.currentMission}` : (aircraft ? "ON STANDBY" : NAVIGATION_DATA.destination);

    return (
        <Card className="col-span-5 glass-panel flex flex-col">
            <CardHeader className="py-2 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400">NAVIGATION DATA</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 grid grid-cols-2 gap-4 items-center">
                <div className="bg-black/40 p-4 rounded border border-white/10 h-full flex flex-col justify-center">
                    <span className="text-slate-500 text-xs font-bold block mb-1 tracking-wider">GROUND SPEED</span>
                    <span className="text-4xl font-bold text-slate-200 font-mono tracking-tighter">
                        {speedKmh} <span className="text-sm text-slate-500 font-normal">km/h</span>
                    </span>
                </div>
                <div className="flex flex-col gap-2 h-full">
                    <div className="bg-black/40 p-2 px-3 rounded border border-white/10 flex justify-between items-center flex-1">
                        <span className="text-slate-500 text-xs font-bold tracking-wider">HEADING</span>
                        <span className="text-xl font-bold text-slate-200 font-mono">{headingDeg}°</span>
                    </div>
                    <div className="bg-black/40 p-2 px-3 rounded border border-white/10 flex justify-between items-center flex-1">
                        <span className="text-slate-500 text-xs font-bold tracking-wider">DIST REMAIN</span>
                        <span className="text-xl font-bold text-amber-500 font-mono">120 m</span>
                    </div>
                    <div className="bg-black/40 p-2 px-3 rounded border border-white/10 flex justify-between items-center flex-1">
                        <span className="text-slate-500 text-xs font-bold tracking-wider">DESTINATION</span>
                        <span className="text-slate-200 font-bold text-xs font-mono">{destination}</span>
                    </div>
                </div>
                {/* Progress Bar (Full Width) */}
                <div className="col-span-2 relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-amber-500 w-[75%] shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                </div>
            </CardContent>
        </Card>
    );
}
