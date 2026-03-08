import { Button } from "@/shared/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { ShieldAlert, AlertTriangle, PlayCircle } from "lucide-react"; // [UPDATED] Added PlayCircle icon

interface PilotSafetyLockProps {
    moveState: string; // 'stopped' | 'moving' | 'paused' ...
    handleResume: () => void;
    handleEmergencyStop: () => void;
}

export function PilotSafetyLock({ moveState, handleResume, handleEmergencyStop }: PilotSafetyLockProps) {
    // [LOGIC] Strict Button Activation
    const isResumeActive = moveState === 'paused';
    const isEmergencyActive = moveState === 'moving' || moveState === 'pushback';

    return (
        <Card className="col-span-2 glass-panel border border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.05)] flex flex-col">
            <CardHeader className="py-2 border-b border-red-900/30 bg-red-950/10">
                <CardTitle className="text-sm font-black tracking-wide text-red-500 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    CRITICAL
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-3 flex flex-col gap-3">
                {/* Resume Pushback Button (Replaces Mode Toggle) */}
                <div className="flex-1 relative">
                    <Button
                        onClick={handleResume}
                        disabled={!isResumeActive}
                        className={`w-full h-full flex flex-col items-center justify-center border transition-all rounded-md
                            ${isResumeActive
                                ? 'bg-cyan-950/30 border-cyan-500 text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            }
                        `}
                    >
                        <PlayCircle className={`w-5 h-5 mb-1 ${isResumeActive ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] mb-1 opacity-70 font-bold tracking-wider">ACTION</span>
                        <span className="text-base font-black tracking-wide">RESUME</span>
                    </Button>
                </div>

                {/* Emergency Stop */}
                <Button
                    onClick={handleEmergencyStop}
                    disabled={!isEmergencyActive}
                    className={`flex-1 border-none shadow-[0_0_15px_rgba(220,38,38,0.4)] p-2 rounded-md transition-all
                        ${isEmergencyActive 
                            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse-slow cursor-pointer' 
                            : 'bg-slate-900/50 text-slate-600 cursor-not-allowed grayscale opacity-50 shadow-none'
                        }
                    `}
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
