import { useState, useEffect } from "react";
import { AlertCircle, XOctagon, CheckCircle, Radio, TriangleAlert, Bell } from "lucide-react";
import { useStompClient } from "@/shared/realtime/clients/useStompClient";
import { cn } from "@/shared/lib/utils";
import { useTimelineStore } from "./model/useTimelineStore";

// --- Types (Match Backend DTO) ---
type NotificationType = 'MISSION_REQUEST' | 'MANUAL_CONTROL' | 'EMERGENCY_STOP';

interface PathOptionDto {
    optionId: number;
    label: string;
    edgeIds: string[];
}

interface AdminAlertDto {
    type: NotificationType;
    message?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    
    // Mission Specific
    flightId?: number;
    flightNumber?: string;
    pilotId?: string;
    currentGate?: string;
    activeRunway?: string;
    pathOptions?: PathOptionDto[];
    
    // Internal
    id: string; // for React key
    timestamp: number;
}

export function ApprovalQueue() {
    const [alerts, setAlerts] = useState<AdminAlertDto[]>([]);
    
    // --- WebSocket ---
    const { onMessage, request } = useStompClient({
        url: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket',
        enabled: true 
    });

    useEffect(() => {
        const unsubscribe = onMessage((msg: any) => {
             // Basic structure check
            if (msg.flightId || msg.type) {
                const newAlert: AdminAlertDto = {
                    ...msg,
                    type: msg.type || 'MISSION_REQUEST',
                    id: Date.now().toString() + Math.random(),
                    timestamp: Date.now()
                };
                
                // EMERGENCY_STOP goes to top, others append
                setAlerts(prev => {
                    if (newAlert.type === 'EMERGENCY_STOP') {
                        return [newAlert, ...prev];
                    }
                    return [newAlert, ...prev];
                });
            }
        });
        return () => unsubscribe();
    }, [onMessage]);

    const addLog = useTimelineStore(state => state.addLog);

    // --- Actions ---
    const handleDecision = async (alert: AdminAlertDto, approved: boolean) => {
        if (!alert.flightId) return;

        try {
            // [TEST MODE] Bypass Backend for Mock Data
            if (alert.flightId === 101) {
                console.log("[TEST] Skipping Backend Call for Mock Flight 101");
            } else {
                await request('/app/mission/decide', {
                    flightId: alert.flightId, 
                    approved: approved,       
                    rejectReason: approved ? null : "Denied by ATC",
                    // Mock selection: first path logic
                    selectedEdgeIds: alert.pathOptions?.[0]?.edgeIds || ['E1', 'E2'], 
                    destNode: alert.activeRunway || "RUNWAY"
                });
            }
            
            // Log to Timeline
            addLog({
                type: approved ? 'APPROVE' : 'REJECT',
                message: approved ? `PUSHBACK APPROVED: ${alert.flightNumber}` : `PUSHBACK REJECTED: ${alert.flightNumber}`,
                subMessage: approved ? `Dest: ${alert.activeRunway || "N/A"}` : `Reason: Denied by ATC`,
                actor: "ATC-Controller"
            });

            // Remove from list on success
            setAlerts(prev => prev.filter(a => a.id !== alert.id));
        } catch (e) {
            console.error("Decision Failed", e);
            alert("Failed to send decision");
        }
    };

    const handleConfirm = (id: string) => {
        const target = alerts.find(a => a.id === id);
        if (target) {
             addLog({
                type: 'CONFIRM',
                message: target.type === 'EMERGENCY_STOP' ? "EMERGENCY STOP CONFIRMED" : "MANUAL CONTROL CONFIRMED",
                subMessage: target.message || "Situational awareness confirmed.",
                actor: "ATC-Controller"
            });
        }
        // Just remove from list
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div className="flex flex-col h-[40%] glass-panel rounded-xl p-0 relative overflow-hidden shrink-0 border-accent-red/20 shadow-[0_0_15px_rgba(255,0,0,0.05)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-2 border-b border-white/10 bg-white/5">
                <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-accent-red" />
                    Approval Queue
                    {alerts.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{alerts.length}</span>
                    )}
                </h2>
                {alerts.length > 0 && <div className="h-2 w-2 rounded-full bg-accent-red animate-ping" />}
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {alerts.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-xs text-center">
                        <CheckCircle className="w-8 h-8 mb-2" />
                        NO PENDING ACTIONS
                    </div>
                )}

                {alerts.map((alert) => {
                    const isMission = alert.type === 'MISSION_REQUEST';
                    const isEmergency = alert.type === 'EMERGENCY_STOP' || alert.type === 'MANUAL_CONTROL';
                    
                    // Style Config based on logic
                    const borderClass = isMission ? "border-accent-cyan/40" : "border-accent-orange/40";
                    const bgClass = isMission ? "bg-accent-cyan/5 hover:bg-accent-cyan/10" : "bg-accent-orange/5 hover:bg-accent-orange/10";
                    const textClass = isMission ? "text-accent-cyan" : "text-accent-orange";
                    
                    return (
                        <div 
                            key={alert.id}
                            className={cn(
                                "p-3 rounded border relative overflow-hidden group transition-all animate-in slide-in-from-left-2 duration-300",
                                borderClass, bgClass
                            )}
                        >
                            {/* Time Badge */}
                            <div className="absolute top-0 right-0 p-1.5">
                                <span className={cn("text-[9px] font-mono opacity-70", textClass)}>
                                    {new Date(alert.timestamp).toLocaleTimeString([], {hour12: false})}
                                </span>
                            </div>

                            {/* Title & Icon */}
                            <h3 className={cn("text-sm font-bold mb-1 flex items-center gap-2 text-white")}>
                                {isMission && <Radio className={cn("w-3 h-3", textClass)} />}
                                {alert.type === 'MANUAL_CONTROL' && <Bell className={cn("w-3 h-3", textClass)} />}
                                {alert.type === 'EMERGENCY_STOP' && <TriangleAlert className={cn("w-3 h-3", textClass)} />}
                                
                                <span className={textClass}>
                                    {alert.type === 'MISSION_REQUEST' && "PUSHBACK REQUEST"}
                                    {alert.type === 'MANUAL_CONTROL' && "MANUAL OVERRIDE"}
                                    {alert.type === 'EMERGENCY_STOP' && "EMERGENCY STOP"}
                                </span>
                            </h3>

                            {/* Content Body */}
                            <div className="text-[11px] text-gray-400 leading-tight mb-3 pl-1 font-mono">
                                {isMission ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span>FLIGHT: <span className="text-white">{alert.flightNumber}</span></span>
                                            <span>GATE: <span className="text-white">{alert.currentGate}</span></span>
                                        </div>
                                        <div className="mt-1 text-gray-500">
                                            REQ: Dest <span className="text-accent-cyan">{alert.activeRunway || "N/A"}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-gray-300">
                                        {alert.message || (alert.type === 'EMERGENCY_STOP' ? "Pilot triggered EMERGENCY STOP." : "Manual control engaged by pilot.")}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {isMission ? (
                                    <>
                                        <button 
                                            onClick={() => handleDecision(alert, true)}
                                            className="flex-1 py-1.5 bg-accent-cyan/10 border border-accent-cyan/50 text-accent-cyan text-[10px] font-bold rounded hover:bg-accent-cyan hover:text-black transition-all uppercase"
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => handleDecision(alert, false)}
                                            className="flex-1 py-1.5 bg-transparent border border-red-500/30 text-red-500 text-[10px] font-bold rounded hover:bg-red-500/10 transition-colors uppercase"
                                        >
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => handleConfirm(alert.id)}
                                        className="flex-1 py-1.5 bg-accent-orange/10 border border-accent-orange/50 text-accent-orange text-[10px] font-bold rounded hover:bg-accent-orange hover:text-black transition-all uppercase"
                                    >
                                        Confirm
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>


            {/* DEBUG: Temporary Testing Controls */}
            {import.meta.env.DEV && (
                <div className="p-2 border-t border-white/10 flex gap-2 justify-center opacity-50 hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => setAlerts(prev => [{
                            id: Date.now().toString(),
                            type: 'MANUAL_CONTROL',
                            message: "Pilot requested MANUAL CONTROL",
                            timestamp: Date.now()
                        }, ...prev])}
                        className="text-[10px] bg-accent-orange/20 text-accent-orange px-2 py-1 rounded"
                    >
                        [TEST] Manual
                    </button>
                    <button 
                        onClick={() => setAlerts(prev => [{
                            id: Date.now().toString(),
                            type: 'EMERGENCY_STOP',
                            message: "EMERGENCY STOP TRIGGERED",
                            timestamp: Date.now()
                        }, ...prev])}
                        className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded"
                    >
                        [TEST] Emergency
                    </button>
                     <button 
                        onClick={() => setAlerts(prev => [{
                            id: Date.now().toString(),
                            type: 'MISSION_REQUEST',
                            flightNumber: "KE123",
                            currentGate: "T1-105",
                            activeRunway: "RUNWAY_34L",
                            flightId: 101,
                            timestamp: Date.now()
                        }, ...prev])}
                        className="text-[10px] bg-accent-cyan/20 text-accent-cyan px-2 py-1 rounded"
                    >
                        [TEST] Request
                    </button>
                </div>
            )}
        </div>
    );
}
