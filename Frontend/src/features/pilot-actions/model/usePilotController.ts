import { useState, useEffect, useCallback, useRef } from "react";
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from "./usePilotSocket";
import { WS_TOPICS } from "@/shared/realtime/config/topics";
import { MoveState, ConnectionState, PilotLog } from "./pilot.types";
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
  const [fetchedCarId, setFetchedCarId] = useState<string | undefined>(undefined);

  // --- Derived State (using Selectors) ---
  const aircrafts = useAircraftStore((s) => s.aircrafts);
  const activeCarId = selectActiveCarId(aircrafts, flightInfo, initialCarId, fetchedCarId);
  const socketCarId = selectSocketCarId(flightInfo, fetchedCarId, initialCarId);
  const { isEmergencyStopEnabled, isResumeEnabled } = selectButtonStates(moveState, connState);

  // --- Mission State Restore ---
  const activeMissions = useMissionStore((state) => state.activeMissions);
  useEffect(() => {
    const carId = flightInfo?.assignedCarId;
    if (carId && activeMissions[carId]?.status === "RUNNING") {
      console.log("[Restore] Found RUNNING mission -> pushback");
      if (moveState !== "pushback") setMoveState("pushback");
    }
  }, [flightInfo, activeMissions, setMoveState, moveState]);

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
        action: connState === "idle" ? "CONNECT TUG" : "DISCONNECT TUG",
        onConfirm: () => {
          if (!flightInfo) {
            addLog("error", "SYS: Flight Info not loaded yet");
            return;
          }
          if (!send) {
            addLog("error", "SYS: Socket Not Connected");
            return;
          }

          const isConnecting = connState === "idle";
          const endpoint = isConnecting
            ? WS_TOPICS.PILOT.CONNECT
            : WS_TOPICS.PILOT.DISCONNECT;

          setConnState("waiting");
          addLog(
            "info",
            isConnecting
              ? "REQ: Requesting Connection..."
              : "REQ: Requesting Disconnection...",
          );

          const payload = isConnecting
            ? { flightNumber: flightInfo.flightNumber }
            : { flightId: flightInfo.flightId };

          const sent = send("SEND", { destination: endpoint }, JSON.stringify(payload));

          if (!sent) {
            setConnState(isConnecting ? "idle" : "connected");
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
