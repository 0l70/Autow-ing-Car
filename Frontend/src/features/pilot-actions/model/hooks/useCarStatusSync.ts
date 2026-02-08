import { useEffect, useRef } from 'react';
import { useAircraftStore } from '@/entities/aircraft';
import { useMissionStore } from '@/entities/mission';
import { usePilotStore } from '../usePilotStore';

interface UseCarStatusSyncOptions {
  socketCarId: string | undefined;
  addLog: (type: "info" | "success" | "warning" | "error", message: string) => void;
}

/**
 * 차량 상태 동기화 훅
 * Backend Car Status → Frontend UI State 매핑
 */
export function useCarStatusSync({ socketCarId, addLog }: UseCarStatusSyncOptions) {
  const aircrafts = useAircraftStore((s) => s.aircrafts);
  const activeMissions = useMissionStore((s) => s.activeMissions);
  const { moveState, setMoveState, connState, setConnState } = usePilotStore();
  
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    // Debug Log: Trace inputs
    // console.log(`[Sync] Hook Run. SocketCarId: ${socketCarId}, ConnState: ${connState}`);

    if (!socketCarId) return;

    const myCar = aircrafts.find((a) => a.id === socketCarId);
    
    // [Failsafe] If assigned car is NOT found in the store, it might be disconnected or stale ID.
    // We should probably reset the UI to avoid being stuck in "Connecting" forever.
    if (!myCar) {
       // Only log if we are NOT in idle, to avoid spam
       if (connState !== 'idle') {
           console.warn(`[Sync] Car ${socketCarId} not found in store! Force resetting to IDLE.`);
           setConnState("idle");
           setMoveState("stopped");
       }
       return;
    }

    // console.log(`[Sync] Car Found. Status: ${myCar.status}`);

    // [New] Transition Check: Undocking Complete (to WAITING_FOR_RETURN)
    // When status changes from UNDOCKING to WAITING_FOR_RETURN, it means the tug has successfully detached and is ready to leave.
    // Also handle TOWING -> WAITING_FOR_RETURN in case UNDOCKING is skipped or missed.
    const isUndockingComplete = (prevStatus.current === "UNDOCKING" || prevStatus.current === "TOWING" || prevStatus.current === "CONNECTED") && (myCar.status === "WAITING_FOR_RETURN" || myCar.status === "RETURNING");
    
    if (isUndockingComplete) {
        console.log(`[Sync] Undocking Complete (${prevStatus.current} -> ${myCar.status}). Resetting UI.`);
        addLog("success", "Undocking completed. Tug is returning to base.");
        
        // Force Reset UI to Initial State
        // This will causing the "CONNECT" / "REQUEST PUSHBACK" buttons to appear
        setMoveState("stopped");
        setConnState("idle"); 
        
        // Update ref and return to avoid falling into other checks immediately
        prevStatus.current = myCar.status;
        return;
    }

    // 1. MOVING_TO_GATE / DOCKING => 'connecting'
    if (myCar.status === "MOVING_TO_GATE" || myCar.status === "DOCKING") {
      if (connState !== "connecting") {
        console.log(`[Sync] Status: ${myCar.status} -> UI: connecting`);
        addLog(
          "info",
          "Tug connecting..."
        );
        setConnState("connecting");
      }
    }
    // 2. TOWING / UNDOCKING => 'connected'
    // [Modified] UNDOCKING is now treated as an Active State
    else if (myCar.status === "TOWING" || myCar.status === "UNDOCKING") {
      if (connState !== "connected") {
        console.log(`[Sync] Status: ${myCar.status} -> UI: connected`);
        if (moveState !== "pushback" && moveState !== "waiting") {
             // Only show 'connected' msg if coming from fresh connection, not just status flip
             if (myCar.status === "TOWING") addLog("success", "Tug connected successfully.");
        }
        setConnState("connected");
      }
    }
    // 3. STOP => 'paused' (Emergency Stop)
    else if (myCar.status === "STOP") {
      // [Fix] Only transition to 'paused' if we were actually moving or in pushback phase.
      // Do NOT override 'waiting' or 'stopped' states.
      if (moveState === "moving" || moveState === "pushback") {
        console.log("[Sync] Status: STOP -> UI: paused");
        setMoveState("paused");
      }
    }
    // 4. IDLE / WAITING_FOR_RETURN / RETURNING => 'idle'
    else if (
      myCar.status === "IDLE" ||
      myCar.status === "RETURNING" ||
      myCar.status === "WAITING_FOR_RETURN"
    ) {
      // FORCE Reset connection state if it is currently active
      // This ensures that even if we missed a transition, we eventually sync to IDLE
      if (
        connState !== "idle"
      ) {
        console.log(`[Sync] Status: ${myCar.status} -> UI: idle (Force Reset)`);
        setConnState("idle");
      }

      // Force stop if no mission running OR if car is clearly IDLE
      // If the car says IDLE, we trust IT over the mission store (which might be stale)
      // const isMissionRunning = activeMissions[socketCarId]?.status === "RUNNING"; 
      // ^ Removed dependency on stale mission store
      
      if (moveState !== "stopped") {
        console.log(`[Sync] Status: ${myCar.status} -> Force Stop (IDLE override)`);
        setMoveState("stopped");
      }
    }

    // Update Previous Status
    prevStatus.current = myCar.status;

  }, [aircrafts, socketCarId, connState, moveState, activeMissions, addLog, setConnState, setMoveState]);
}
