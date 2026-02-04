import { useState, useRef, useEffect, useCallback } from "react";
import useLongPress from "@/shared/lib/useLongPress";
import { usePilotSocket } from "@/features/pilot-actions/model/usePilotSocket";
import { useSystemLogs } from "./useSystemLogs";
import { FlightInfo, FlightInfoSchema } from "./dashboardTypes";
import { WS_TOPICS } from "@/shared/realtime/config/topics";

// TODO: derivation or constants for Car ID
const MY_CAR_ID = "TC01";

export type MoveState = "stopped" | "pushback" | "towing";
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "waiting"
  | "disconnecting";

export function usePilotDashboard() {
  // --- States ---
  const { addLog } = useSystemLogs();
  const [moveState, setMoveState] = useState<MoveState>("stopped");
  const [connState, setConnState] = useState<ConnectionState>("disconnected");
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: string;
    onConfirm: () => void;
  }>({ open: false, action: "", onConfirm: () => {} });

  // --- Side Effects & Refs ---
  const lastLoadedFlightId = useRef<number | null>(null);

  // --- WebSocket Connection ---
  const { isConnected, request, onMessage } = usePilotSocket(MY_CAR_ID);

  // --- Handle Global/Private Messages ---
  useEffect(() => {
    const unsubscribe = onMessage((messageWrapper) => {
      // Extract body from messageWrapper
      const msg = messageWrapper?.body || messageWrapper;

      console.log("[PilotDashboard] Message Received:", msg);

      // 1. Flight Info 메시지 처리
      const flightParsed = FlightInfoSchema.safeParse(msg);
      if (flightParsed.success) {
        const data = flightParsed.data;
        console.log("[PilotDashboard] Flight Info Received:", data);

        // ✅ 중복 로그 방지: Flight ID가 바뀔 때만 로그 추가
        if (lastLoadedFlightId.current !== data.flightId) {
          addLog("info", `Flight ${data.flightNumber} loaded`);
          lastLoadedFlightId.current = data.flightId;
        }

        setFlightInfo(data);
        return;
      }

      // 2. 미션 상태 업데이트 처리 (승인/시작)
      if (msg.message === "Mission Updated" && msg.status) {
        console.log("[PilotDashboard] Mission Status Update:", msg);

        // RUNNING = 승인됨, 이동 시작
        if (msg.status === "RUNNING") {
          setMoveState("pushback");
          addLog("success", `✓ PUSHBACK APPROVED`);
          if (msg.destNode) {
            addLog("info", `Moving to: ${msg.destNode}`);
          }
        }
        // COMPLETED = 완료
        else if (msg.status === "COMPLETED") {
          setMoveState("stopped");
          addLog("success", `✓ Mission Completed`);
        }
        // CANCELLED = 반려됨
        else if (msg.status === "CANCELLED") {
          setMoveState("stopped");
          addLog("error", `✗ PUSHBACK REJECTED`);
        }
        return;
      }

      // 3. 서버 응답 메시지 처리 (커넥션 상태 등)
      if (msg.status && msg.message) {
        const type = msg.status === "SUCCESS" ? "success" : "error";
        addLog(type, `[${msg.status}] ${msg.message}`);

        // ✅ 자동/수동 공통: 메시지 내용에 따라 UI 상태 동기화
        if (msg.status === "SUCCESS") {
          if (msg.message.includes("Connected Successfully")) {
            setConnState("connected");
          } else if (msg.message.includes("Disconnected Successfully")) {
            setConnState("disconnected");
          }
        } else if (msg.status === "FAIL") {
          // 실패 시 대기 상태 해제 (원복)
          if (msg.message.includes("Connect")) setConnState("disconnected");
          if (msg.message.includes("Disconnect")) setConnState("connected");
        }
      }
    });
    return () => unsubscribe();
  }, [onMessage, addLog]);

  // --- Handlers ---
  const handleConfirmAction = () => {
    confirmModal.onConfirm();
    setConfirmModal({ ...confirmModal, open: false });
  };

  const handleCancelAction = () => {
    setConfirmModal({ ...confirmModal, open: false });
  };

  const handleEmergencyStop = useCallback(() => {
    setMoveState("stopped");
    setIsAutoMode(false);
    addLog("error", "!!! EMERGENCY STOP TRIGGERED !!!");
    alert("EMERGENCY STOP! All Systems Halted.");
    // TODO: Send WS command if needed
  }, [addLog]);

  // --- Button Actions (LongPress) ---
  const moveLongPress = useLongPress(() => {
    setConfirmModal({
      open: true,
      action: moveState === "stopped" ? "REQUEST PUSHBACK" : "STOP VEHICLE",
      onConfirm: async () => {
        const command = moveState === "stopped" ? "MOVE" : "STOP";
        try {
          await request(WS_TOPICS.PILOT.MOVE, {
            type: command,
            carId: MY_CAR_ID,
            timestamp: Date.now(),
          });
        } catch (e) {
          addLog("error", "SYS: Move Request Failed");
        }

        if (moveState === "stopped") setMoveState("pushback");
        else setMoveState("stopped");
      },
    });
  });

  const connLongPress = useLongPress(() => {
    if (["waiting", "connecting", "disconnecting"].includes(connState)) return;

    setConfirmModal({
      open: true,
      action: connState === "disconnected" ? "CONNECT TUG" : "DISCONNECT TUG",
      onConfirm: async () => {
        if (!flightInfo) {
          addLog("error", "SYS: Flight Info not loaded yet");
          return;
        }

        const isConnect = connState === "disconnected";
        const topic = isConnect
          ? WS_TOPICS.PILOT.CONNECT
          : WS_TOPICS.PILOT.DISCONNECT;

        setConnState("waiting");

        try {
          await request(
            topic,
            {
              flightId: flightInfo.flightId,
              timestamp: Date.now(),
            },
            5000,
          );
        } catch (e) {
          setConnState(isConnect ? "disconnected" : "connected");
          addLog("error", "SYS: Connection Request Timeout");
        }
      },
    });
  });

  const modeLongPress = useLongPress(() => {
    setConfirmModal({
      open: true,
      action: !isAutoMode ? "SWITCH TO AUTO" : "SWITCH TO MANUAL",
      onConfirm: async () => {
        const newMode = !isAutoMode ? "AUTO" : "MANUAL";
        try {
          await request(WS_TOPICS.PILOT.MODE, {
            mode: newMode,
            carId: MY_CAR_ID,
          });
          setIsAutoMode(!isAutoMode);
        } catch (e) {
          addLog("error", "SYS: Mode Change Failed");
        }
      },
    });
  });

  return {
    // States
    moveState,
    connState,
    isAutoMode,
    flightInfo,
    confirmModal,
    isConnected,

    // Handlers
    handleConfirmAction,
    handleCancelAction,
    handleEmergencyStop,

    // Props for Buttons
    moveLongPress,
    connLongPress,
    modeLongPress,

    // Utils
    addLog,
  };
}
