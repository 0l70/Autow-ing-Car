import { useState, useEffect, useCallback } from "react";
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from "./usePilotSocket";
import { WS_TOPICS } from "@/shared/realtime/config/topics";
import { usePilotStore } from "./usePilotStore";

import { useFlightWelcome } from "./useFlightWelcome";
import { useAircraftStore } from "@/entities/aircraft";
import { useMissionStore } from "@/entities/mission";

// [NEW] Extracted hooks and selectors
import { useCarStatusSync, usePilotMessages } from "./hooks";
import { selectActiveCarId, selectButtonStates, selectSocketCarId } from "./selectors";

export function usePilotController(initialCarId?: string) {
  // --- State (from Store) ---
  const {
    moveState,
    setMoveState,
    connState,
    setConnState,
    logs,
    addLog: addStoreLog,
  } = usePilotStore();

  const flightInfo = useMissionStore((state) => state.flightInfo);
  const fetchedCarId = undefined; // setFetchedCarId removed

  // --- Derived State (using Selectors) ---
  const aircrafts = useAircraftStore((s) => s.aircrafts);
  const activeCarId = selectActiveCarId(aircrafts, flightInfo, initialCarId, fetchedCarId);
  const socketCarId = selectSocketCarId(flightInfo, fetchedCarId, initialCarId);
  const { isEmergencyStopEnabled, isResumeEnabled } = selectButtonStates(moveState, connState);

  // --- Mission State Restore ---
  const activeMissions = useMissionStore((state) => state.activeMissions);
  useEffect(() => {
    const carId = flightInfo?.assignedCarId;
    const car = aircrafts.find(a => a.id === carId);
    
    // Only restore pushback if mission is RUNNING AND car is actually active (not IDLE/WAITING)
    // [Fix] Restrict state restoration to only valid 'pushback' compatible sates.
    // AND [Fix] ONLY trigger restoration if we are NOT actively waiting for a response.
    const isCarActive = car && (car.status === 'TOWING' || car.status === 'STOP');
    
    if (carId && activeMissions[carId]?.status === "RUNNING" && isCarActive) {
      // The state belongs to a 'RUNNING' session. 
      // If we are currently 'stopped' or 'idle', it means we are re-entering/refreshing. Restore it.
      // If we are 'waiting', it means we just sent a request and must NOT be forced into pushback yet.
      if (moveState === "stopped" || connState === "idle") {
        console.log("[Restore] Restoring active RUNNING session -> pushback");
        setMoveState("pushback");
      }
    }
  }, [flightInfo, activeMissions, setMoveState, moveState, aircrafts, connState]);

  // --- Modal State ---
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: string;
    onConfirm: () => void;
  }>({ open: false, action: "", onConfirm: () => {} });

  // --- Welcome Logic ---
  const {
    isOpen: isWelcomeOpen,
    checkAndShow: checkWelcome,
    close: closeWelcome,
  } = useFlightWelcome();

  // --- WebSocket ---
  const { send, onMessage, isConnected } = usePilotSocket(socketCarId);

  // --- Logger Wrapper ---
  const addLog = useCallback(
    (type: "info" | "success" | "warning" | "error", message: string) => {
      addStoreLog({ type, message });
    },
    [addStoreLog],
  );

  // --- [REFACTORED] Status Sync (extracted hook) ---
  useCarStatusSync({ socketCarId, addLog });

  // --- [REFACTORED] Message Handler (extracted hook) ---
  usePilotMessages({ onMessage, addLog, checkWelcome });

  // --- Actions ---

  // 1. Movement Actions (Pushback Request)
  const moveLongPress = useLongPress(
    () => {
      if (moveState !== "stopped") return;

      setConfirmModal({
        open: true,
        action: "REQUEST PUSHBACK",
        onConfirm: () => {
          if (!flightInfo) {
            addLog("error", "SYS: Flight Info not found");
            return;
          }
          if (!send) {
            addLog("error", "SYS: Socket Not Connected");
            return;
          }

          setMoveState("waiting");
          addLog("info", "REQ: Requesting Pushback Agreement...");

          const sent = send(
            "SEND",
            { destination: WS_TOPICS.PILOT.MOVE },
            JSON.stringify({
              type: "PUSHBACK",
              flightId: flightInfo.flightId,
              carId: activeCarId,
            }),
          );

          if (!sent) {
            setMoveState("stopped");
            addLog("error", "SYS: Not Connected");
          }
        },
      });
    },
    () => {},
  );

  // 2. Connection Actions (Connect / Disconnect)
  const connLongPress = useLongPress(
    () => {
      if (
        connState === "waiting" ||
        connState === "connecting" ||
        moveState === "waiting" ||
        moveState === "pushback" ||
        moveState === "moving"
      )
        return;

      setConfirmModal({
        open: true,
        action: "CONNECT TUG",
        onConfirm: () => {
          if (!flightInfo) {
            addLog("error", "SYS: Flight Info not loaded yet");
            return;
          }
          if (!send) {
            addLog("error", "SYS: Socket Not Connected");
            return;
          }

          const endpoint = WS_TOPICS.PILOT.CONNECT;

          setConnState("waiting");
          addLog("info", "REQ: Requesting Connection...");

          const payload = { flightNumber: flightInfo.flightNumber };

          const sent = send("SEND", { destination: endpoint }, JSON.stringify(payload));

          if (!sent) {
            setConnState("idle");
            addLog("error", "SYS: Not Connected");
          }
        },
      });
    },
    () => {},
  );

  // 3. Resume Pushback Action
  const handleResume = useCallback(() => {
    if (moveState !== "paused") return;

    setConfirmModal({
      open: true,
      action: "RESUME PUSHBACK",
      onConfirm: () => {
        if (!activeCarId) {
          addLog("error", "SYS: No Active Car to resume");
          return;
        }
        if (!send) {
          addLog("error", "SYS: Socket Not Connected");
          return;
        }

        send(
          "SEND",
          { destination: WS_TOPICS.PILOT.RESUME },
          JSON.stringify({ carId: activeCarId }),
        );

        setMoveState("pushback");
        addLog("info", "CMD: Resuming Pushback...");
      },
    });
  }, [moveState, activeCarId, send, addLog, setMoveState]);

  // 4. Emergency Stop
  const handleEmergencyStop = useCallback(() => {
    if (moveState !== "moving" && moveState !== "pushback") return;

    setMoveState("paused");

    if (activeCarId && send) {
      send(
        "SEND",
        { destination: WS_TOPICS.PILOT.EMERGENCY },
        JSON.stringify({ carId: activeCarId }),
      );
      addLog("error", "!!! REQ: EMERGENCY STOP SENT !!!");
    } else {
      addLog("error", "!!! EMERGENCY STOP (Local Only) !!!");
    }

    alert("EMERGENCY STOP! All Systems Halted.");
  }, [addLog, activeCarId, send, moveState, setMoveState]);

  // 5. Modal Handlers
  const handleConfirm = useCallback(() => {
    confirmModal.onConfirm();
    setConfirmModal((prev) => ({ ...prev, open: false }));
  }, [confirmModal]);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    state: {
      logs,
      move: moveState,
      connection: connState,
      flightInfo,
      isConnected,
      confirmModal,
      welcomeModal: { open: isWelcomeOpen },
      isEmergencyStopEnabled,
      isResumeEnabled,
    },
    controls: {
      moveLongPress,
      connLongPress,
      handleResume,
      handleEmergencyStop,
      handleConfirm,
      closeConfirmModal,
      closeWelcomeModal: closeWelcome,
      addLog,
    },
  };
}
