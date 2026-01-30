import { useState, useEffect, useCallback, useRef } from 'react';
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from './usePilotSocket';
import { MoveState, ConnectionState, PilotLog } from './types';
import { FlightInfo, FlightInfoSchema } from "@/features/dashboard/model/dashboardTypes";

import { useFlightWelcome } from './useFlightWelcome'; // [NEW]
import { useGraphStore } from '@/entities/map/model/store';

export function usePilotController(initialCarId?: string) {
    // --- State ---
    const [logs, setLogs] = useState<PilotLog[]>([]);
    const [moveState, setMoveState] = useState<MoveState>('stopped');
    const [connState, setConnState] = useState<ConnectionState>('disconnected');
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);
    const lastLoadedFlightId = useRef<number | null>(null);

    // [Dynamic Car ID Logic]
    // If we have flight info with an assigned car, use it. Otherwise fallback to initial.
    const activeCarId = flightInfo?.assignedCarId || initialCarId;

    // --- Modal State ---
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        action: string;
        onConfirm: () => void;
    }>({ open: false, action: '', onConfirm: () => { } });
    
    // --- Welcome Logic (Extracted) ---
    const { isOpen: isWelcomeOpen, checkAndShow: checkWelcome, close: closeWelcome } = useFlightWelcome();

    // --- WebSocket ---
    const { request, send, onMessage, isConnected } = usePilotSocket(activeCarId);

    // --- Logger ---
    const addLog = useCallback((type: 'info' | 'success' | 'warning' | 'error', message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [{ id: Date.now(), type, message, timestamp: time }, ...prev]);
    }, []);

    // --- Dynamic Status Sync ---
    const aircrafts = useGraphStore(s => s.aircrafts);
    
    useEffect(() => {
        if (!activeCarId) {
            // console.log("[Sync] Waiting for activeCarId...");
            return;
        }
        const myCar = aircrafts.find(a => a.id === activeCarId);
        
        if (!myCar) {
            // console.log(`[Sync] My car ${activeCarId} not found in store artifacts. Current cars:`, aircrafts.map(a => a.id));
            return;
        }

        console.log(`[Sync] Car ${activeCarId} Status: ${myCar.status}, UI State: ${connState}`);

        // Auto State Transition based on Real Telemetry
        if (myCar.status === 'LOADING') {
            if (connState !== 'waiting' && connState !== 'connecting') {
                addLog('info', 'Status synchronized: Connecting...');
                setConnState('waiting');
            }
        } else if (myCar.status === 'TOWING') {
            if (connState !== 'connected') {
                console.log("[Sync] Transitioning to CONNECTED");
                addLog('success', 'Status synchronized: Connected');
                setConnState('connected');
            }
        } else if (myCar.status === 'IDLE' || myCar.status === 'MOVING_TO_IDLE') {
             // Only reset to DISCONNECTED if we were securely connected. 
             // Do NOT reset if we are currently 'waiting' or 'connecting' for a response.
             if (connState === 'connected' || connState === 'disconnecting') {
                console.log("[Sync] Transitioning to DISCONNECTED");
                setConnState('disconnected');
             }
        }
    }, [aircrafts, activeCarId, connState, addLog]);

    // --- Message Handler ---
    useEffect(() => {
        const unsubscribe = onMessage((msg) => {
            const payload = msg.body || msg; // Unwrap Stomp Message Wrapper

            // 1. Flight Info
            const flightParsed = FlightInfoSchema.safeParse(payload);
            if (flightParsed.success) {
                const data = flightParsed.data;
                if (lastLoadedFlightId.current !== data.flightId) {
                    addLog('info', `Flight ${data.flightNumber} loaded`);
                    lastLoadedFlightId.current = data.flightId;
                    
                    // Trigger Welcome Check using the hook
                    checkWelcome(data.flightId);
                }
                setFlightInfo(data);
                return;
            }

            // 2. Status / Response Messages
            if (payload.status && payload.message) {
                const type = payload.status === 'SUCCESS' || payload.status === 'APPROVED' ? 'success' : 'error';
                addLog(type, `[${payload.status}] ${payload.message}`);

                // State Transitions based on Server Response
                if (payload.status === 'SUCCESS') {
                     // We rely on Telemetry for Connection State, but we can trust explicit "Disconnected" msg
                    if (payload.message.includes("Disconnected Successfully")) {
                        // setConnState('disconnected'); // Let telemetry handle it
                    }
                } else if (payload.status === 'APPROVED') {
                    // Pushback Approved
                    if (moveState === 'waiting') {
                        setMoveState('pushback');
                        if (payload.data && payload.data.destNodeName) {
                            addLog('info', `PATH: To [${payload.data.destNodeName}] assigned`);
                        }
                    }
                } else if (payload.status === 'FAIL') {
                    if (payload.message.includes("Connect")) setConnState('disconnected');
                    if (payload.message.includes("Disconnect")) setConnState('connected');
                    if (moveState === 'waiting') setMoveState('stopped');
                }
            }
        });
        return () => unsubscribe();
    }, [onMessage, moveState, connState, addLog, checkWelcome]);


    // --- Actions ---
    
    // 1. Movement Actions (Pushback / Stop)
    const moveLongPress = useLongPress(() => {
        setConfirmModal({
            open: true,
            action: moveState === 'stopped' ? 'REQUEST PUSHBACK' : 'STOP VEHICLE',
            onConfirm: () => {
                if (moveState === 'stopped') {
                    setMoveState('waiting');
                    addLog('info', 'REQ: Requesting Pushback Agreement...');

                    if (!flightInfo) {
                        addLog('error', 'SYS: Flight Info not found');
                        setMoveState('stopped');
                        return;
                    }
                    
                    const sent = send('SEND', { destination: '/app/car/move' }, JSON.stringify({
                        type: 'PUSHBACK',
                        flightId: flightInfo.flightId,
                        carId: activeCarId,
                        // reqId removed
                    }));

                    if (!sent) {
                        setMoveState('stopped');
                        addLog('error', 'SYS: Not Connected');
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
            onConfirm: () => {
                if (!flightInfo) {
                    addLog('error', 'SYS: Flight Info not loaded yet');
                    return;
                }
                const isConnecting = connState === 'disconnected';
                const endpoint = isConnecting ? '/app/car/dispatch' : '/app/car/disconnect';
                
                setConnState('waiting');
                addLog('info', isConnecting ? 'REQ: Requesting Connection...' : 'REQ: Requesting Disconnection...');

                const payload = isConnecting
                    ? { flightNumber: flightInfo.flightNumber }
                    : { flightId: flightInfo.flightId };

                const sent = send('SEND', { destination: endpoint }, JSON.stringify(payload));

                if (!sent) {
                    setConnState(isConnecting ? 'disconnected' : 'connected');
                    addLog('error', 'SYS: Not Connected');
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
             confirmModal,
             welcomeModal: { open: isWelcomeOpen } // [Refactored]
        },
        controls: {
            moveLongPress,
            connLongPress,
            modeLongPress,
            handleEmergencyStop,
            handleConfirm,
            closeConfirmModal,
            closeWelcomeModal: closeWelcome, // [Refactored]
            addLog
        }
    };
}
