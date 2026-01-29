import { Button } from "@/shared/ui/Button";
import { MoveState, ConnectionState } from "@/features/dashboard/model/dashboardTypes";

interface PilotCommandButtonsProps {
    moveState: MoveState;
    connState: ConnectionState;
    moveLongPress: any; // Return type of useLongPress
    connLongPress: any; // Return type of useLongPress
}

export function PilotCommandButtons({ moveState, connState, moveLongPress, connLongPress }: PilotCommandButtonsProps) {
    return (
        <div className="col-span-2 flex flex-col gap-4">
            {/* Move Button */}
            <div className="relative group flex-1">
                <Button
                    {...moveLongPress}
                    disabled={connState !== 'connected' || moveState === 'waiting'}
                    className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border whitespace-normal leading-tight glass-panel
                        ${moveState === 'moving' || moveState === 'pushback'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                            : moveState === 'waiting'
                                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait'
                                : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-cyan-500/50 hover:text-cyan-400'
                        }
                        disabled:opacity-30 disabled:cursor-not-allowed
                    `}
                >
                    {moveState === 'stopped' ? 'REQUEST PUSHBACK' 
                        : moveState === 'waiting' ? 'WAITING...' 
                        : 'STOP'}

                    {moveState !== 'waiting' && (
                        <div className="text-[9px] font-normal opacity-50 absolute bottom-2 font-mono w-full text-center tracking-widest">
                            HOLD 1S
                        </div>
                    )}

                    {moveState === 'waiting' && (
                        <div className="absolute top-2 right-2">
                            <div className="w-2 h-2 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                        </div>
                    )}
                </Button>
            </div>

            {/* Connection Button */}
            <div className="relative group flex-1">
                <Button
                    {...connLongPress}
                    className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border whitespace-normal leading-tight glass-panel
                        ${connState === 'connected'
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            : (connState === 'connecting' || connState === 'waiting')
                                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait'
                                : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-cyan-500/50 hover:text-cyan-400'
                        }
                    `}
                >
                    {connState === 'connected' ? 'DISCONNECT TUG'
                        : connState === 'waiting' ? 'WAITING...'
                            : connState === 'connecting' ? 'CONNECTING...'
                                : 'CONNECT TUG'}

                    {connState === 'connected' && (
                        <div className="text-[9px] font-normal opacity-50 absolute bottom-2 font-mono w-full text-center tracking-widest">
                            HOLD 1S
                        </div>
                    )}

                    {(connState === 'waiting' || connState === 'connecting') && (
                        <div className="absolute top-2 right-2">
                            <div className="w-2 h-2 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
}
