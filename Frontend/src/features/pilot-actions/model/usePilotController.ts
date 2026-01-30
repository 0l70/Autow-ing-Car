import { useState, useEffect, useCallback, useRef } from 'react';
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from './usePilotSocket';
import { MoveState, ConnectionState, PilotLog } from './types';
import { FlightInfo, FlightInfoSchema } from "@/features/dashboard/model/dashboardTypes";

export function usePilotController(carId: string) {
    // --- State ---
    const [logs, setLogs] = useState<PilotLog[]>([]);
    const [moveState, setMoveState] = useState<MoveState>('stopped');
    const [connState, setConnState] = useState<ConnectionState>('disconnected');
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);
    const lastLoadedFlightId = useRef<number | null>(null);

    // --- Modal State ---
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        action: string;
        onConfirm: () => void;
    }>({ open: false, action: '', onConfirm: () => { } });

    // --- WebSocket ---
    const { request, onMessage, isConnected } = usePilotSocket(carId);

    // --- Logger ---
    const addLog = useCallback((type: 'info' | 'success' | 'warning' | 'error', message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [{ id: Date.now(), type, message, timestamp: time }, ...prev]);
    }, []);

    // --- Message Handler ---
    useEffect(() => {
        const unsubscribe = onMessage((msg) => {
            // 1. Flight Info
            const flightParsed = FlightInfoSchema.safeParse(msg);
            if (flightParsed.success) {
                const data = flightParsed.data;
                if (lastLoadedFlightId.current !== data.flightId) {
                    addLog('info', `Flight ${data.flightNumber} loaded`);
                    lastLoadedFlightId.current = data.flightId;
                }
                setFlightInfo(data);
                return;
            }

            // 2. Status / Response Messages
            if (msg.status && msg.message) {
                const type = msg.status === 'SUCCESS' || msg.status === 'APPROVED' ? 'success' : 'error';
                addLog(type, `[${msg.status}] ${msg.message}`);

                // State Transitions based on Server Response
                if (msg.status === 'SUCCESS') {
                    if (msg.message.includes("Connected Successfully")) {
                        setConnState('connected');
                    } else if (msg.message.includes("Disconnected Successfully")) {
                        setConnState('disconnected');
                    }
                } else if (msg.status === 'APPROVED') {
                    // Pushback Approved
                    if (moveState === 'waiting') {
                        setMoveState('pushback');
                        if (msg.data && msg.data.destNodeName) {
                            addLog('info', `PATH: To [${msg.data.destNodeName}] assigned`);
                        }
                    }
                } else if (msg.status === 'FAIL') {
                    if (msg.message.includes("Connect")) setConnState('disconnected');
                    if (msg.message.includes("Disconnect")) setConnState('connected');
                    if (moveState === 'waiting') setMoveState('stopped');
                }
            }
        });
        return () => unsubscribe();
    }, [onMessage, moveState, connState, addLog]);


    // --- Actions ---
    
    // 1. Movement Actions (Pushback / Stop)
    const moveLongPress = useLongPress(() => {
        setConfirmModal({
            open: true,
            action: moveState === 'stopped' ? 'REQUEST PUSHBACK' : 'STOP VEHICLE',
            onConfirm: async () => {
                if (moveState === 'stopped') {
                    setMoveState('waiting');
                    addLog('info', 'REQ: Requesting Pushback Agreement...');
                    try {
                        if (!flightInfo) {
                            addLog('error', 'SYS: Flight Info not found');
                            setMoveState('stopped');
                            return;
                        }
                        await request('/app/car/move', {
                            type: 'PUSHBACK',
                            flightId: flightInfo.flightId,
                            carId,
                            reqId: `req-${Date.now()}`
                        }, 5000);
                    } catch (e) {
                        setMoveState('stopped');
                        addLog('error', 'SYS: Pushback Request Timeout');
                    }
                } else {
                    setMoveState('stopped');
                    addLog('info', 'CMD: Vehicle Stopped');
                }
            }
        });
    }, () => { });

    // 2. Connection Actions (Connect / Disconnect)
    const connLongPress = useLongPress(() => {
        if (connState === 'waiting' || connState === 'connecting' || connState === 'disconnecting') return;

        setConfirmModal({
            open: true,
            action: connState === 'disconnected' ? 'CONNECT TUG' : 'DISCONNECT TUG',
            onConfirm: async () => {
                if (!flightInfo) {
                    addLog('error', 'SYS: Flight Info not loaded yet');
                    return;
                }
                const isConnecting = connState === 'disconnected';
                const endpoint = isConnecting ? '/app/car/connect' : '/app/car/disconnect';
                
                setConnState('waiting');
                addLog('info', isConnecting ? 'REQ: Requesting Connection...' : 'REQ: Requesting Disconnection...');

                try {
                    await request(endpoint, {
                        flightId: flightInfo.flightId,
                        reqId: `req-${Date.now()}`
                    }, 5000);
                } catch (e) {
                    // Revert state on failure
                    setConnState(isConnecting ? 'disconnected' : 'connected');
                    addLog('error', 'SYS: Request Timeout');
                }
            }
        });
    }, () => { });

    // 3. Mode Switch
    const modeLongPress = useLongPress(() => {
        setConfirmModal({
            open: true,
            action: !isAutoMode ? 'SWITCH TO AUTO' : 'SWITCH TO MANUAL',
            onConfirm: () => {
                setIsAutoMode(!isAutoMode);
                addLog('info', !isAutoMode ? 'SYS: Auto Pilot Engaged' : 'SYS: Manual Control Engaged');
            }
        });
    }, () => { });

    // 4. Emergency Stop
    const handleEmergencyStop = useCallback(() => {
        setMoveState('stopped');
        setIsAutoMode(false);
        addLog('error', '!!! EMERGENCY STOP TRIGGERED !!!');
        alert('EMERGENCY STOP! All Systems Halted.');
    }, [addLog]);

    // 5. Confirm Modal Handler
    const handleConfirm = useCallback(() => {
        confirmModal.onConfirm();
        setConfirmModal(prev => ({ ...prev, open: false }));
    }, [confirmModal]);

    const closeConfirmModal = useCallback(() => {
        setConfirmModal(prev => ({ ...prev, open: false }));
    }, []);


    return {
        state: {
             logs,
             move: moveState,
             connection: connState,
             isAutoMode,
             flightInfo,
             isConnected,
             confirmModal
        },
        controls: {
            moveLongPress,
            connLongPress,
            modeLongPress,
            handleEmergencyStop,
            handleConfirm,
            closeConfirmModal,
            addLog
        }
    };
}
