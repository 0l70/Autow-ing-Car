import { useEffect } from 'react';
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

  useEffect(() => {
    if (!socketCarId) return;

    const myCar = aircrafts.find((a) => a.id === socketCarId);
    if (!myCar) return;

    // 1. MOVING_TO_GATE / DOCKING => 'connecting'
    if (myCar.status === "MOVING_TO_GATE" || myCar.status === "DOCKING") {
      if (connState !== "connecting") {
        console.log(`[Sync] Status: ${myCar.status} -> UI: connecting`);
        addLog(
          "info",
          myCar.status === "MOVING_TO_GATE"
            ? "Tug dispatching to gate..."
            : "Tug docking..."
        );
        setConnState("connecting");
      }
    }
    // 2. TOWING => 'connected'
    else if (myCar.status === "TOWING") {
      if (connState !== "connected") {
        console.log("[Sync] Status: TOWING -> UI: connected");
        if (moveState !== "pushback" && moveState !== "waiting") {
          addLog("success", "Tug connected successfully.");
        }
        setConnState("connected");
      }
    }
    // 3. STOP => 'paused' (Emergency Stop)
    else if (myCar.status === "STOP") {
      if (moveState !== "paused") {
        console.log("[Sync] Status: STOP -> UI: paused");
        setMoveState("paused");
      }
    }
    // 4. IDLE / RETURNING / UNDOCKING => 'idle'
    else if (
      myCar.status === "IDLE" ||
      myCar.status === "RETURNING" ||
      myCar.status === "WAITING_FOR_RETURN" ||
      myCar.status === "UNDOCKING"
    ) {
      // Reset connection state
      if (
        connState === "connected" ||
        connState === "connecting" ||
        connState === "waiting"
      ) {
        console.log(`[Sync] Status: ${myCar.status} -> UI: idle`);
        if (connState === "connected") addLog("info", "Tug disconnected.");
        setConnState("idle");
      }

      // Force stop if no mission running
      const isMissionRunning = activeMissions[socketCarId]?.status === "RUNNING";
      if (moveState !== "stopped" && !isMissionRunning) {
        console.log(`[Sync] Status: ${myCar.status} -> Force Stop`);
        setMoveState("stopped");
      }
    }
  }, [aircrafts, socketCarId, connState, moveState, activeMissions, addLog, setConnState, setMoveState]);
}
