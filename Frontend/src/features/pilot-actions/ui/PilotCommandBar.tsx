import { Button } from "@/shared/ui/Button";
import { MoveState, ConnectionState } from "../model/pilot.types";

interface PilotCommandBarProps {
    moveState: MoveState;
    connState: ConnectionState;
    // We will clean up the LongPress props later by passing handlers directly
    // For now, keep as is to facilitate quick migration, or better, simplify to onClick
    // The plan said "UI components... accept props instead of being context-aware".
    // Passing longPress handlers is fine for now.
    moveLongPress: any; 
    connLongPress: any; 
}

export function PilotCommandBar({ moveState, connState, moveLongPress, connLongPress }: PilotCommandBarProps) {
    return (
        <div className="col-span-2 flex flex-col gap-2">
            {/* Move Button */}
            <div className="relative group flex-1">
                <Button
                    {...moveLongPress}
                    disabled={connState !== 'connected' || moveState === 'waiting' || moveState === 'pushback' || moveState === 'moving' || moveState === 'paused'}
                    className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border whitespace-normal leading-tight glass-panel
                        ${moveState === 'moving' || moveState === 'pushback'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                            : moveState === 'paused'
                                ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/20'
                                : moveState === 'waiting'
                                    ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait'
                                    : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-cyan-500/50 hover:text-cyan-400'
                        }
                        disabled:cursor-not-allowed
                    `}
                >
                    {moveState === 'stopped' ? 'REQUEST PUSHBACK' 
                        : moveState === 'waiting' ? 'WAITING...' 
                        : moveState === 'paused' ? 'PUSHBACK PAUSED'
                        : 'MOVING'}

                    {(moveState === 'stopped' || moveState === 'paused') && connState === 'connected' && (
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
                    disabled={moveState === 'waiting' || moveState === 'pushback' || moveState === 'moving' || moveState === 'paused'}
                    className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border whitespace-normal leading-tight glass-panel
                        ${connState === 'connected' && moveState === 'stopped'
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            : (connState === 'connecting' || connState === 'waiting' || moveState === 'waiting' || moveState === 'pushback' || moveState === 'moving' || moveState === 'paused')
                                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait'
                                : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-cyan-500/50 hover:text-cyan-400'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-slate-600 disabled:hover:text-slate-500
                    `}
                >
                    {moveState === 'waiting' ? 'WAITING APPROVAL...'
                        : moveState === 'paused' ? 'EMERGENCY STOPPED'
                        : (moveState === 'pushback' || moveState === 'moving') ? 'HAVE A SAFE FLIGHT'
                        : connState === 'connected' ? 'DISCONNECT TUG'
                        : connState === 'waiting' ? 'WAITING...'
                            : connState === 'connecting' ? 'CONNECTING...'
                                : 'CONNECT TUG'}

                    {connState === 'connected' && moveState === 'stopped' && (
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
