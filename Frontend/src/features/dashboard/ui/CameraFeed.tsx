import { useEffect, useRef } from 'react';
import { useWebRTC } from '../lib/useWebRTC';
import { cn } from '@/shared/lib/utils';
import { Video, VideoOff, Wifi, WifiOff } from 'lucide-react';

interface CameraFeedProps {
    className?: string;
    enabled: boolean;
    carId: string;
    pilotId?: string; // Optional, currently defaulting to "PILOT_001" or AuthUser
}

export function CameraFeed({ className, enabled, carId, pilotId = "PILOT_001" }: CameraFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { stream, connectionState, isWaitingForResponse } = useWebRTC({ enabled, carId, pilotId });

    // Stream Binding: When stream is ready, attach to video element
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Derived Status for UI
    const isConnected = connectionState === 'connected';
    
    // UI 로직: 
    // 1. 응답 대기 중이거나 초기 상태(new)면 "연결 중" 표시
    // 2. 응답이 왔는데 연결이 안 됐거나(failed/disconnected), 수동으로 닫힌(closed) 경우 중 스트림이 있었으면 "연결 끊김" 표시
    const isConnecting = isWaitingForResponse || connectionState === 'new' || connectionState === 'connecting';
    const isFailed = !isWaitingForResponse && (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') && !isConnected;

    if (!enabled) {
        return (
            <div className={cn("relative bg-black/80 flex flex-col items-center justify-center text-slate-500", className)}>
                <VideoOff className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs font-mono tracking-wider">CAMERA FEED DISABLED</span>
                <span className="text-[10px] opacity-50 font-mono mt-1">ENABLE TO VIEW</span>
            </div>
        );
    }

    return (
        <div className={cn("relative bg-black overflow-hidden group", className)}>
            {/* 1. Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted // Always mute playback to avoid feedback loop
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    isConnected ? "opacity-100" : "opacity-0"
                )}
            />

            {/* 2. Loading / State Overlays */}
            {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                    {isConnecting && (
                        <>
                             <div className="w-8 h-8 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin mb-3"></div>
                             <span className="text-xs text-accent-cyan font-mono animate-pulse">ESTABLISHING LINK...</span>
                        </>
                    )}
                    {isFailed && (
                        <>
                             <WifiOff className="w-8 h-8 text-red-500 mb-2" />
                             <span className="text-xs text-red-500 font-mono">CONNECTION LOST</span>
                             <span className="text-[10px] text-red-400/50 font-mono mt-1">{connectionState.toUpperCase()}</span>
                        </>
                    )}
                </div>
            )}

            {/* 3. Live Indicator (Only shown when connected) */}
            {isConnected && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 border border-green-500/30 px-2 py-1 rounded text-[10px] text-green-400 shadow-[0_0_10px_rgba(0,255,0,0.2)] backdrop-blur-sm z-20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#0f0]" />
                    <span className="font-bold tracking-wider">LIVE</span>
                </div>
            )}

            {/* 4. Tech Overlay (Decorations) */}
            <div className="absolute inset-0 pointer-events-none border border-white/5 z-20">
                {/* Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center opacity-30">
                    <div className="w-[1px] h-full bg-white/50" />
                    <div className="absolute h-[1px] w-full bg-white/50" />
                </div>
                {/* ID Label */}
                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-white/50 bg-black/40 px-1 rounded">
                    {carId} : {pilotId}
                </div>
            </div>
        </div>
    );
}
