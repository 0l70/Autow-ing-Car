import { Button } from "@/shared/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { ShieldAlert, AlertTriangle } from "lucide-react";

interface PilotSafetyControlsProps {
    isAutoMode: boolean;
    modeLongPress: any; // Return type of useLongPress
    handleEmergencyStop: () => void;
}

export function PilotSafetyControls({ isAutoMode, modeLongPress, handleEmergencyStop }: PilotSafetyControlsProps) {
    return (
        <Card className="col-span-2 glass-panel border border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.05)] flex flex-col">
            <CardHeader className="py-2 border-b border-red-900/30 bg-red-950/10">
                <CardTitle className="text-sm font-black tracking-wide text-red-500 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    CRITICAL
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-3 flex flex-col gap-3">
                {/* Mode Toggle */}
                <div className="flex-1 relative">
                    <Button
                        {...modeLongPress}
                        className={`w-full h-full flex flex-col items-center justify-center border transition-all rounded-md
                            ${isAutoMode
                                ? 'bg-slate-800 border-cyan-500 text-cyan-400'
                                : 'bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/20'
                            }
                        `}
                    >
                        <span className="text-[10px] mb-1 opacity-70 font-bold tracking-wider">OP MODE</span>
                        <span className="text-base font-black tracking-wide">{isAutoMode ? 'AUTO' : 'MANUAL'}</span>
                    </Button>
                </div>

                {/* Emergency Stop */}
                <Button
                    onClick={handleEmergencyStop}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse-slow p-2 rounded-md"
                >
                    <div className="flex flex-col items-center justify-center text-center">
                        <AlertTriangle className="w-5 h-5 stroke-[3] mb-1" />
                        <span className="text-xs font-black leading-none tracking-tight">EMERGENCY<br />STOP</span>
                    </div>
                </Button>
            </CardContent>
        </Card>
    );
}
