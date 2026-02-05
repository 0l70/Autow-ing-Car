import { useState, useEffect, useCallback, useRef } from "react";
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from "./usePilotSocket";
import { MoveState, ConnectionState, PilotLog } from "./pilot.types"; // [UPDATED] Import from new file
import { usePilotStore } from "./usePilotStore"; // [NEW] Import Store
import {
  FlightInfo,
  FlightInfoSchema,
} from "@/features/dashboard/model/dashboardTypes";

import { useFlightWelcome } from "./useFlightWelcome";
import { useAircraftStore } from "@/entities/aircraft";
import { useMissionStore } from "@/entities/mission";
import { pilotApi } from "../api/pilotApi";
import { AircraftStatus, Aircraft } from "@/entities/map/model/types";

// --- LocalStorage Keys Removed (Handled by Store) ---

export function usePilotController(initialCarId?: string) {
  // const { accessToken } = useAuthStore(); // [NEW] - Removed because apiClient handles it
  const ingestAircraft = useAircraftStore((state) => state.ingest);

  // --- State (Replaced with Store) ---
  const { 
      moveState, setMoveState, 
      connState, setConnState, 
      isAutoMode, setIsAutoMode,
      logs, addLog: addStoreLog, clearLogs
  } = usePilotStore();
  
  // const [logs, setLogs] = useState<PilotLog[]>([]); // Removed
  // const [moveState, setMoveState] = useState<MoveState>("stopped"); // Removed
  // const [connState, setConnState] = useState<ConnectionState>("idle"); // Removed
  // const [isAutoMode, setIsAutoMode] = useState(false); // Removed

  const flightInfo = useMissionStore((state) => state.flightInfo);
  const setFlightInfo = useMissionStore((state) => state.setFlightInfo);
  const [fetchedCarId, setFetchedCarId] = useState<string | undefined>(
    undefined,
  );
  const lastLoadedFlightId = useRef<number | null>(null);
  const hasFetchedStatus = useRef(false); // [NEW] Prevent double fetch

  // [Dynamic Car ID Logic with IDLE Filtering]
  // Only show car info if it's actively moving or connected (not IDLE)
  const aircrafts = useAircraftStore((s) => s.aircrafts);
  const assignedCar = flightInfo?.assignedCarId
    ? aircrafts.find((a) => a.id === flightInfo.assignedCarId)
    : null;

  // Filter: Only show Tug if status is NOT IDLE/UNLOADING (i.e., actively dispatched or connected)
  const activeCarId =
    assignedCar &&
    assignedCar.status !== "IDLE" &&
    assignedCar.status !== "UNLOADING"
      ? assignedCar.id
      : (initialCarId || fetchedCarId) &&
          aircrafts.find(
            (a) =>
              (a.id === initialCarId || a.id === fetchedCarId) &&
              a.status !== "IDLE",
          )
        ? initialCarId || fetchedCarId
        : undefined;

  // --- Initial State Sync ---
  // Store handles persistence, but we might want to check MISSION status to override local state if backend says otherwise.
  const activeMissions = useMissionStore((state) => state.activeMissions);
  
  useEffect(() => {
    // Priority 1: Check if there's a RUNNING mission for assigned car
    const carId = flightInfo?.assignedCarId;
    if (carId && activeMissions[carId]) {
      const missionStatus = activeMissions[carId].status;
      if (missionStatus === 'RUNNING') {
        console.log('[Restore] Found RUNNING mission -> pushback');
        if (moveState !== 'pushback') setMoveState('pushback');
        return;
      }
    }
  }, [flightInfo, activeMissions, setMoveState, moveState]);

  // --- Modal State ---
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: string;
    onConfirm: () => void;
  }>({ open: false, action: "", onConfirm: () => {} });

  // --- Welcome Logic (Extracted) ---
  const {
    isOpen: isWelcomeOpen,
    checkAndShow: checkWelcome,
    close: closeWelcome,
  } = useFlightWelcome();

  // --- WebSocket ---
  // [FIX] Always subscribe to assigned car even if it's IDLE (so we can catch status changes)
  // Fallback to fetchedCarId or initialCarId initially on refresh.
  const socketCarId = flightInfo?.assignedCarId || fetchedCarId || initialCarId;
  const { send, onMessage, isConnected } = usePilotSocket(socketCarId);

  // --- Logger Wrapper ---
  // Using useCallback to match existing signature, but delegating to store
  const addLog = useCallback(
    (type: "info" | "success" | "warning" | "error", message: string) => {
        addStoreLog({ type, message });
    },
    [addStoreLog],
  );

  // --- Dynamic Status Sync ---

  // --- Dynamic Status Sync ---

  useEffect(() => {
    // [FIX] Use socketCarId to ensure we sync even if car is IDLE (filtered from activeCarId)
    const targetId = socketCarId;
    if (!targetId) {
      return;
    }
    const myCar = aircrafts.find((a) => a.id === targetId);

    if (!myCar) {
      return;
    }

    // console.log(
    //   `[Sync] MyCar: ${myCar.id}, Status: ${myCar.status}, UI State: ${connState}`,
    // );

    // [Logic Update] Map Backend Status to UI Button State

    // 1. MOVING_TO_LOAD / LOADING => 'connecting' (User sees "Connecting...")
    if (myCar.status === "MOVING_TO_LOAD" || myCar.status === "LOADING") {
      if (connState !== "connecting") {
        console.log(`[Sync] Status: ${myCar.status} -> UI: connecting`);
        addLog(
          "info",
          myCar.status === "MOVING_TO_LOAD"
            ? "Tug dispatching to gate..."
            : "Tug docking...",
        );
        setConnState("connecting");
      }
    }

    // 2. TOWING (Connected) => 'connected' (User sees "Disconnect Tug")
    else if (myCar.status === "TOWING") {
      if (connState !== "connected") {
        console.log("[Sync] Status: TOWING -> UI: connected");
        // Only log "Connected" if we weren't already in pushback mode
        if (moveState !== "pushback" && moveState !== "waiting") {
          addLog("success", "Tug connected successfully.");
        }
        setConnState("connected");
      }
    }

    // 3. IDLE / MOVING_TO_IDLE / UNLOADING => 'disconnected' (User sees "Connect Tug")
    else if (
      myCar.status === "IDLE" ||
      myCar.status === "MOVING_TO_IDLE" ||
      myCar.status === "UNLOADING"
    ) {
      // Reset to idle if we were in any active connection state
      if (
        connState === "connected" ||
        connState === "connecting" ||
        connState === "waiting"
      ) {
        console.log(`[Sync] Status: ${myCar.status} -> UI: idle`);
        if (connState === "connected") addLog("info", "Tug disconnected.");
        setConnState("idle");
      }
    }
  }, [aircrafts, socketCarId, connState, addLog, moveState]);

  // --- Message Handler ---
  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      const payload = msg.body || msg; // Unwrap Stomp Message Wrapper

      // 1. Flight Info
      const flightParsed = FlightInfoSchema.safeParse(payload);
      if (flightParsed.success) {
        const data = flightParsed.data;
        if (lastLoadedFlightId.current !== data.flightId) {
          addLog("info", `Flight ${data.flightNumber} loaded`);
          lastLoadedFlightId.current = data.flightId;

          // Trigger Welcome Check using the hook
          checkWelcome(data.flightId);
        }
        setFlightInfo(data);
        return;
      } else {
        // [DEBUG LOG]
        // Only log if it LOOKS like flight info (check some unique field) to avoid spamming on every misc message
        if (payload.flightId || payload.flightNumber) {
          console.warn(
            "[PilotController] FlightInfo Parse Failed:",
            flightParsed.error,
          );
        }
      }

      // 2-1. REJECTED 처리 (거절 시 message가 "Mission Updated"가 아님!)
      if (payload.status === "REJECTED" && payload.message) {
        console.log("[PilotController] 🚨 Mission REJECTED:", payload);
        setMoveState("stopped"); // waiting → stopped (REQUEST PUSHBACK 버튼 다시 표시)
        addLog("error", `✗ PUSHBACK REJECTED: ${payload.message}`);
        return;
      }

      // 2-2. Mission Status Updates (승인/완료)
      if (payload.message === "Mission Updated" && payload.status) {
        console.log("[PilotController] 🚨 Mission Status Update:", payload);

        // RUNNING = 승인됨, 이동 시작
        if (payload.status === "RUNNING") {
          if (moveState === "waiting") {
            setMoveState("pushback");
            addLog("success", `✓ PUSHBACK APPROVED`);
            if (payload.destNode) {
              addLog("info", `Moving to: ${payload.destNode}`);
            }
          }
        }
        // COMPLETED = 완료
        else if (payload.status === "COMPLETED") {
          setMoveState("stopped");
          addLog("success", `✓ Mission Completed`);
        }
        // CANCELLED = 반려됨
        else if (payload.status === "CANCELLED") {
          setMoveState("stopped"); // REQUEST PUSHBACK 버튼 다시 표시
          addLog("error", `✗ PUSHBACK CANCELLED`);
        }
        return; // 처리 완료, 다른 핸들러로 넘어가지 않음
      }

      // 3. Status / Response Messages
      if (payload.status && payload.message) {
        const type =
          payload.status === "SUCCESS" || payload.status === "APPROVED"
            ? "success"
            : "error";
        addLog(type, `[${payload.status}] ${payload.message}`);

        // State Transitions based on Server Response
        if (payload.status === "SUCCESS") {
          // We rely on Telemetry for Connection State, but we can trust explicit "Disconnected" msg
          if (payload.message.includes("Disconnected Successfully")) {
            // setConnState('disconnected'); // Let telemetry handle it
          }
        } else if (payload.status === "APPROVED") {
          // Pushback Approved
          if (moveState === "waiting") {
            setMoveState("pushback");
            if (payload.data && payload.data.destNodeName) {
              addLog(
                "info",
                `PATH: To [${payload.data.destNodeName}] assigned`,
              );
            }
          }
        } else if (payload.status === "REJECTED" || payload.status === "FAIL") {
          // Rejected or Failed
          if (payload.message.includes("Connect")) setConnState("idle");
          if (payload.message.includes("Disconnect")) setConnState("connected");
          if (moveState === "waiting") setMoveState("stopped");
        }
      }
    });
    return () => unsubscribe();
  }, [onMessage, moveState, connState, addLog, checkWelcome]);

  // --- Actions ---

  // 1. Movement Actions (Pushback Request + Resume)
  const moveLongPress = useLongPress(
    () => {
      // [NEW] Resume Pushback when paused
      if (moveState === "paused") {
        setConfirmModal({
          open: true,
          action: "RESUME PUSHBACK",
          onConfirm: () => {
            if (!activeCarId) {
              addLog("error", "SYS: No Active Car to resume");
              return;
            }

            send(
              "SEND",
              { destination: "/app/car/resume" },
              JSON.stringify({ carId: activeCarId }),
            );
            
            setMoveState("pushback");
            addLog("info", "CMD: Resuming Pushback...");
          },
        });
        return;
      }

      // Only allow pushback request when stopped
      if (moveState !== "stopped") return;

      setConfirmModal({
        open: true,
        action: "REQUEST PUSHBACK",
        onConfirm: () => {
          if (!flightInfo) {
            addLog("error", "SYS: Flight Info not found");
            return;
          }

          // Save to localStorage handled by Store Persist automatically when we setState
          setMoveState("waiting");
          addLog("info", "REQ: Requesting Pushback Agreement...");

          const sent = send(
            "SEND",
            { destination: "/app/car/move" },
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
      // Block action if connection is in progress, waiting for approval, OR vehicle is moving
      if (connState === "waiting" || connState === "connecting" || 
          moveState === "waiting" || moveState === "pushback" || moveState === "moving") return;

      setConfirmModal({
        open: true,
        action: connState === "idle" ? "CONNECT TUG" : "DISCONNECT TUG",
        onConfirm: () => {
          if (!flightInfo) {
            addLog("error", "SYS: Flight Info not loaded yet");
            return;
          }
          const isConnecting = connState === "idle";
          const endpoint = isConnecting
            ? "/app/car/dispatch"
            : "/app/car/disconnect";

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

          const sent = send(
            "SEND",
            { destination: endpoint },
            JSON.stringify(payload),
          );

          if (!sent) {
            setConnState(isConnecting ? "idle" : "connected");
            addLog("error", "SYS: Not Connected");
          }
        },
      });
    },
    () => {},
  );

  // 3. Mode Switch
  const modeLongPress = useLongPress(
    () => {
      setConfirmModal({
        open: true,
        action: !isAutoMode ? "SWITCH TO AUTO" : "SWITCH TO MANUAL",
        onConfirm: () => {
          setIsAutoMode(!isAutoMode);
          addLog(
            "info",
            !isAutoMode
              ? "SYS: Auto Pilot Engaged"
              : "SYS: Manual Control Engaged",
          );
        },
      });
    },
    () => {},
  );

  // 4. Emergency Stop
  const handleEmergencyStop = useCallback(() => {
    // [NEW] 이동 중이었으면 paused, 아니면 stopped
    // [NEW] 이동 중이었으면 paused, 아니면 stopped
    const newState = (moveState === "pushback" || moveState === "moving") ? "paused" : "stopped";
    setMoveState(newState);
    setIsAutoMode(false);

    // [REVERT] Only allow E-Stop if there is an ACTIVE car (moving/connected)
    // As per user request, we revert the test logic.
    if (activeCarId) {
      send(
        "SEND",
        { destination: "/app/car/emergency" },
        JSON.stringify({
          carId: activeCarId,
        }),
      );
      addLog("error", "!!! REQ: EMERGENCY STOP SENT !!!");
    } else {
      // Now this will only trigger if user manages to click the button while IDLE
      // (though button might be disabled, this safety check remains)
      addLog("error", "!!! EMERGENCY STOP (Local Only - No Active Car) !!!");
    }

    alert("EMERGENCY STOP! All Systems Halted.");
  }, [addLog, activeCarId, send]);

  // 5. Confirm Modal Handler
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
      isAutoMode,
      flightInfo,
      isConnected,
      confirmModal,
      welcomeModal: { open: isWelcomeOpen }, // [Refactored]
    },
    controls: {
      moveLongPress,
      connLongPress,
      modeLongPress,
      handleEmergencyStop,
      handleConfirm,
      closeConfirmModal,
      closeWelcomeModal: closeWelcome, // [Refactored]
      addLog,
    },
  };
}
