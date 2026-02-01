import { useState, useEffect, useCallback, useRef } from 'react';
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from './usePilotSocket';
import { MoveState, ConnectionState, PilotLog } from './types';
import { FlightInfo, FlightInfoSchema } from "@/features/dashboard/model/dashboardTypes";

import { useFlightWelcome } from './useFlightWelcome';
import { useGraphStore } from '@/entities/map/model/store';
import { useAuthStore } from '@/features/auth/model/useAuthStore'; // [NEW]
import { pilotApi } from '../api/pilotApi'; // [NEW]
import { AircraftStatus } from '@/entities/map/model/types'; // [NEW]

export function usePilotController(initialCarId?: string) {
    const { accessToken } = useAuthStore(); // [NEW]
    const { updateAircraft } = useGraphStore(); // [NEW]

    // --- State ---
    const [logs, setLogs] = useState<PilotLog[]>([]);
    const [moveState, setMoveState] = useState<MoveState>('stopped');
    const [connState, setConnState] = useState<ConnectionState>('disconnected');
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);
    const lastLoadedFlightId = useRef<number | null>(null);
    const hasFetchedStatus = useRef(false); // [NEW] Prevent double fetch

    // [Dynamic Car ID Logic with IDLE Filtering]
    // Only show car info if it's actively moving or connected (not IDLE)
    const aircrafts = useGraphStore(s => s.aircrafts);
    const assignedCar = flightInfo?.assignedCarId 
        ? aircrafts.find(a => a.id === flightInfo.assignedCarId) 
        : null;
    
    // Filter: Only show Tug if status is NOT IDLE/UNLOADING (i.e., actively dispatched or connected)
    const activeCarId = (assignedCar && 
                         assignedCar.status !== 'IDLE' && 
                         assignedCar.status !== 'UNLOADING')
        ? assignedCar.id 
        : (initialCarId && aircrafts.find(a => a.id === initialCarId && a.status !== 'IDLE') ? initialCarId : undefined);

    // --- Initial State Sync (REST API) ---
    useEffect(() => {
        if (!accessToken || hasFetchedStatus.current) return;

        const syncStatus = async () => {
             try {
                // Fetch Current Status from Backend
                const statusData = await pilotApi.getTowingCarStatus(accessToken);
                console.log("[StateSync] Fetched Initial Status:", statusData);

                if (statusData.code && statusData.status !== 'NONE') {
                    const status = statusData.status as AircraftStatus;
                    updateAircraft({
                        id: statusData.code,
                        callsign: statusData.code,
                        type: 'TUG',
                        status: status,
                        position: { x: statusData.posX, y: statusData.posY, r: statusData.heading },
                        battery: statusData.battery,
                        speed: statusData.velocity,
                        isLoaded: status === 'TOWING' || status === 'UNLOADING'
                    });
                    hasFetchedStatus.current = true;
                }
             } catch (err) {
                 console.warn("[StateSync] Failed to sync initial status:", err);
             }
        };

        syncStatus();
    }, [accessToken, updateAircraft]);

    // [New] Safe Sync on Assignment (Race Condition Fix)
    useEffect(() => {
        if (!activeCarId || !accessToken) return;

        const safeSync = async () => {
             try {
                const statusData = await pilotApi.getTowingCarStatus(accessToken);
                // Ensure we are syncing the correct car
                if (statusData.code === activeCarId && statusData.status !== 'NONE') {
                     console.log("[SafeSync] Resyncing status for assigned car:", activeCarId);
                     const status = statusData.status as AircraftStatus;
                     
                     // Update Aircraft in Store
                     updateAircraft({
                        id: statusData.code,
                        callsign: statusData.code,
                        type: 'TUG',
                        status: status,
                        position: { x: statusData.posX, y: statusData.posY, r: statusData.heading },
                        battery: statusData.battery,
                        speed: statusData.velocity,
                        isLoaded: status === 'TOWING' || status === 'UNLOADING'
                    });

                    // [FIX] Sync connState based on car status
                    if (status === 'TOWING') {
                        console.log("[SafeSync] Setting connState: connected");
                        setConnState('connected');
                    } else if (status === 'LOADING') {
                        console.log("[SafeSync] Setting connState: connecting");
                        setConnState('connecting');
                    } else if (status === 'MOVING_TO_LOAD') {
                        console.log("[SafeSync] Setting connState: waiting");
                        setConnState('waiting');
                    } else if (status === 'IDLE' || status === 'MOVING_TO_IDLE' || status === 'UNLOADING') {
                        console.log("[SafeSync] Setting connState: disconnected");
                        setConnState('disconnected');
                    }
                }
             } catch (err) {
                 console.warn("[SafeSync] Failed:", err);
             }
        };
        safeSync();
    }, [activeCarId, accessToken, updateAircraft]);

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
    
    useEffect(() => {
        if (!activeCarId) {
            return;
        }
        const myCar = aircrafts.find(a => a.id === activeCarId);
        
        if (!myCar) {
            return;
        }

        console.log(`[Sync] MyCar: ${myCar.id}, Status: ${myCar.status}, UI State: ${connState}`);

        // [Logic Update] Map Backend Status to UI State
        // 1. MOVING_TO_LOAD (Dispatch -> Gate) => 'waiting'
        if (myCar.status === 'MOVING_TO_LOAD') {
            if (connState !== 'waiting') {
                console.log("[Sync] Status: MOVING_TO_LOAD -> UI: waiting");
                addLog('info', 'Tug dispatching to gate...');
                setConnState('waiting');
            }
        }
        // 2. LOADING (Gate -> Docking) => 'connecting'
        else if (myCar.status === 'LOADING') {
            if (connState !== 'connecting') {
                console.log("[Sync] Status: LOADING -> UI: connecting");
                addLog('info', 'Tug arrived. Docking in progress...');
                setConnState('connecting');
            }
        } 
        // 3. TOWING (Connected) => 'connected'
        else if (myCar.status === 'TOWING') {
            if (connState !== 'connected') {
                console.log("[Sync] Status: TOWING -> UI: connected");
                addLog('success', 'Tug connected successfully.');
                setConnState('connected');
            }
        } 
        // 4. IDLE / MOVING_TO_IDLE (Disconnected)
        else if (myCar.status === 'IDLE' || myCar.status === 'MOVING_TO_IDLE') {
             // Only reset to DISCONNECTED if we were currently in a connected-related state
             if (connState === 'connected' || connState === 'disconnecting' || connState === 'connecting' || connState === 'waiting') {
                // Check if we originated this connection (optional safeguard, but simple transition is better here)
                // If we are 'waiting' (dispatching) and suddenly 'IDLE', maybe dispatch failed or was cancelled.
                
                // Don't reset if we literally JUST clicked connect (race condition prevention usually handled by 'waiting')
                // But here, if backend sends IDLE, we should trust it. assuming 'waiting' corresponds to 'MOVING_TO_LOAD' eventually.
                
                // However, we must be careful not to flicker 'disconnected' before the first 'MOVING_TO_LOAD' arrives 
                // if the connection request hasn't been processed by backend yet.
                // But typically backend request returns, sends 'MOVING_TO_LOAD' immediately.
                
                if (connState === 'connected' || connState === 'disconnecting') {
                    console.log("[Sync] Status: IDLE -> UI: disconnected");
                    addLog('info', 'Tug disconnected.');
                    setConnState('disconnected');
                }
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
