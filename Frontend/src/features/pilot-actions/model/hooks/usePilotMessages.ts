import { useEffect, useRef } from 'react';
import { WS_TOPICS } from '@/shared/realtime/config/topics';
import { FlightInfoSchema } from '@/features/dashboard/model/dashboardTypes';
import { useAircraftStore } from '@/entities/aircraft';
import { useMissionStore } from '@/entities/mission';
import { usePilotStore } from '../usePilotStore';
import type { Aircraft } from '@/entities/map/model/types';

interface UsePilotMessagesOptions {
  onMessage: ((cb: (msg: any) => void) => () => void) | undefined;
  addLog: (type: "info" | "success" | "warning" | "error", message: string) => void;
  checkWelcome: (flightId: number) => void;
}

/**
 * 메시지 핸들러 훅
 * WebSocket 메시지 destination 기반 라우팅 및 처리
 */
export function usePilotMessages({ onMessage, addLog, checkWelcome }: UsePilotMessagesOptions) {
  const lastLoadedFlightId = useRef<number | null>(null);
  const { moveState, setMoveState, connState, setConnState } = usePilotStore();
  const setFlightInfo = useMissionStore((s) => s.setFlightInfo);

  useEffect(() => {
    if (!onMessage) return;

    const unsubscribe = onMessage((msg) => {
      const { destination, body } = msg;
      const payload = body || msg;

      // 1. Flight Info
      if (destination === WS_TOPICS.PILOT_FLIGHT_INFO) {
        handleFlightInfo(payload, { lastLoadedFlightId, addLog, checkWelcome, setFlightInfo });
        return;
      }

      // 2. Private Responses
      if (destination === WS_TOPICS.PRIVATE_RESPONSES) {
        handlePrivateResponse(payload, { moveState, setMoveState, connState, setConnState, addLog });
        return;
      }

      // 3. Mission Updates
      if (destination === WS_TOPICS.MISSION_UPDATES) {
        handleMissionUpdate(payload, { moveState, setMoveState, addLog });
        return;
      }

      // 4. Fallback: Ignore other destinations
    });

    return () => unsubscribe();
  }, [onMessage, moveState, connState, addLog, checkWelcome, setFlightInfo, setMoveState, setConnState]);
}

// --- Helper Functions ---

function handleFlightInfo(
  payload: any,
  ctx: {
    lastLoadedFlightId: React.MutableRefObject<number | null>;
    addLog: (type: any, msg: string) => void;
    checkWelcome: (id: number) => void;
    setFlightInfo: (info: any) => void;
  }
) {
  const parsed = FlightInfoSchema.safeParse(payload);
  if (parsed.success) {
    const data = parsed.data;
    if (ctx.lastLoadedFlightId.current !== data.flightId) {
      ctx.addLog("info", `Flight ${data.flightNumber} loaded`);
      ctx.lastLoadedFlightId.current = data.flightId;
      ctx.checkWelcome(data.flightId);
    }
    ctx.setFlightInfo(data);
  } else {
    console.warn("[PilotMessages] FlightInfo Parse Failed:", parsed.error);
  }
}

function handlePrivateResponse(
  payload: any,
  ctx: {
    moveState: string;
    setMoveState: (s: any) => void;
    connState: string;
    setConnState: (s: any) => void;
    addLog: (type: any, msg: string) => void;
  }
) {
  // REJECTED 처리
  if (payload.status === "REJECTED" && payload.message) {
    console.log("[PilotMessages] 🚨 Mission REJECTED:", payload);
    ctx.setMoveState("stopped");
    ctx.addLog("error", `✗ PUSHBACK REJECTED: ${payload.message}`);
    return;
  }

  // Status / Response Messages
  if (payload.status && payload.message) {
    const type = payload.status === "SUCCESS" || payload.status === "APPROVED" ? "success" : "error";
    ctx.addLog(type, `[${payload.status}] ${payload.message}`);

    if (payload.status === "APPROVED" && ctx.moveState === "waiting") {
      ctx.setMoveState("pushback");
      if (payload.data?.destNodeName) {
        ctx.addLog("info", `PATH: To [${payload.data.destNodeName}] assigned`);
      }
    } else if (payload.status === "REJECTED" || payload.status === "FAIL") {
      if (payload.message.includes("Connect")) ctx.setConnState("idle");
      if (payload.message.includes("Disconnect")) ctx.setConnState("connected");
      if (ctx.moveState === "waiting") ctx.setMoveState("stopped");
    }
  }
}

function handleMissionUpdate(
  payload: any,
  ctx: {
    moveState: string;
    setMoveState: (s: any) => void;
    addLog: (type: any, msg: string) => void;
  }
) {
  if (payload.message !== "Mission Updated" || !payload.status) return;

  console.log("[PilotMessages] 🚨 Mission Status Update:", payload);

  if (payload.status === "RUNNING" && ctx.moveState === "waiting") {
    ctx.setMoveState("pushback");
    ctx.addLog("success", `✓ PUSHBACK APPROVED`);

    // Update aircraft mission path
    if (payload.edgeIds && payload.towingCarCode) {
      const aircraftStore = useAircraftStore.getState();
      const existing = aircraftStore.aircrafts.find((a) => a.id === payload.towingCarCode);

      if (existing) {
        const updatedAircraft: Aircraft = {
          ...existing,
          currentMission: {
            id: payload.missionId?.toString() || "temp",
            status: "RUNNING",
            path: payload.edgeIds,
          },
        };
        aircraftStore.ingest(updatedAircraft);
      }
    }

    if (payload.destNode) {
      ctx.addLog("info", `Moving to: ${payload.destNode}`);
    }
  } else if (payload.status === "COMPLETED") {
    ctx.setMoveState("stopped");
    ctx.addLog("success", `✓ Mission Completed`);
  } else if (payload.status === "CANCELLED") {
    ctx.setMoveState("stopped");
    ctx.addLog("error", `✗ PUSHBACK CANCELLED`);
  }
}
