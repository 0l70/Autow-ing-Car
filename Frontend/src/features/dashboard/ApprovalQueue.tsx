import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Radio,
  TriangleAlert,
  Bell,
  Route,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useTimelineStore } from "./model/useTimelineStore";
import { useSocket } from "@/shared/realtime/context/SocketProvider";
import { WS_TOPICS } from "@/shared/realtime/config/topics";

// --- Types (Match Backend DTO) ---
type NotificationType = "MISSION_REQUEST" | "MANUAL_CONTROL" | "EMERGENCY_STOP";

interface PathOptionDto {
  optionId: number;
  label: string;
  edgeIds: string[];
}

interface NodeDto {
  id: number;
  nodeCode: string;
  posX: number;
  posY: number;
}

interface AdminAlertDto {
  type: NotificationType;
  message?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";

  // Mission Specific
  flightId?: number;
  flightNumber?: string;
  pilotId?: string;
  currentGate?: string;
  activeRunway?: string;
  pathOptions?: PathOptionDto[];

  // Internal
  id: string; // for React key
  timestamp: number;
}



interface PathOptionsResponseDto {
  flightId: number;
  flightNumber: string;
  departNode: string;
  destNode: string;
  pathOptions: PathOptionDto[];
}

import { useMissionStore } from "@/entities/mission";

export function ApprovalQueue() {
  const [alerts, setAlerts] = useState<AdminAlertDto[]>([]);
  
  // [NEW] 1단계 워크플로우 상태 (경로 선택)
  const [pathOptionsData, setPathOptionsData] = useState<PathOptionsResponseDto | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathOptionDto | null>(null);

  // Global Client from Context
  const { onMessage, send, isConnected } = useSocket() || {};
  const ingestMission = useMissionStore(state => state.ingest);

  useEffect(() => {
    if (!onMessage) return;
    
    // Listen for MISSION_REQUEST and other ATC alerts that aren't persisted in missionStore yet
    const unsubscribe = onMessage((msg: any) => {
      const { destination, body: data } = msg;
      
      if (destination !== WS_TOPICS.CONTROLLER_REQUESTS) return;

      if (data && (data.flightId || data.type)) {
        const newAlert: AdminAlertDto = {
          ...data,
          type: data.type || "MISSION_REQUEST",
          id: Date.now().toString() + Math.random(),
          timestamp: Date.now(),
        };

        setAlerts((prev: AdminAlertDto[]) => [newAlert, ...prev]);
      }
    });

    return () => unsubscribe();
  }, [onMessage]);

  const addLog = useTimelineStore((state) => state.addLog);

  // --- Actions ---
  // [Step 1] 출발 요청 승인 -> 도착지 선택 활성화
  const handleDecision = async (
    alertItem: AdminAlertDto,
    approved: boolean,
  ) => {
    if (!alertItem.flightId) return;

    try {
      if (approved) {
        // [Simplified] Instead of Step 1 approval API, we directly open the Path Options UI
        // using the pathOptions already present in the alertItem (AdminAlertDto).
        if (alertItem.pathOptions && alertItem.pathOptions.length > 0) {
          console.log("[ApprovalQueue] Opening path selection directly");
          setPathOptionsData({
            flightId: alertItem.flightId,
            flightNumber: alertItem.flightNumber || "",
            departNode: alertItem.currentGate || "",
            destNode: alertItem.activeRunway || "", // Default destination in mock
            pathOptions: alertItem.pathOptions,
          });
        } else {
          window.alert("No path options available for this request.");
          return;
        }

        addLog({
          type: "APPROVE",
          message: `PUSHBACK REQUEST ACCEPETED: ${alertItem.flightNumber}`,
          subMessage: `Opening path options...`,
          actor: "ATC-Controller",
        });
      } else {
        if (send) {
          send(
            "SEND",
            {
              destination: WS_TOPICS.ATC.MISSION_DECIDE,
            },
            JSON.stringify({
              flightId: alertItem.flightId,
              approved: false,
              rejectReason: "Denied by ATC",
            }),
          );
        }

        addLog({
          type: "REJECT",
          message: `PUSHBACK REJECTED: ${alertItem.flightNumber}`,
          subMessage: `Reason: Denied by ATC`,
          actor: "ATC-Controller",
        });
      }

      setAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));
    } catch (e) {
      console.error("Decision Failed", e);
      window.alert("Failed to send decision");
    }
  };



  // [Step 3] 경로 승인 -> 미션 생성
  const handleRouteConfirm = () => {
    if (!pathOptionsData || !selectedPath) return;

    console.log("[ApprovalQueue] Step 3: Confirming route via MISSION_DECIDE", selectedPath);
    if (send) {
      send(
        "SEND",
        {
          destination: WS_TOPICS.ATC.MISSION_DECIDE,
        },
        JSON.stringify({
          flightId: pathOptionsData.flightId,
          approved: true,
          destNode: pathOptionsData.destNode,
          selectedEdgeIds: selectedPath.edgeIds,
        }),
      );
    }

    addLog({
      type: "APPROVE",
      message: `ROUTE CONFIRMED: ${pathOptionsData.flightNumber}`,
      subMessage: `${pathOptionsData.departNode} → ${pathOptionsData.destNode} (${selectedPath.edgeIds.length} edges)`,
      actor: "ATC-Controller",
    });

    setPathOptionsData(null);
    setSelectedPath(null);
  };

  const handleConfirm = (id: string) => {
    const target = alerts.find((a) => a.id === id);
    if (target) {
      addLog({
        type: "CONFIRM",
        message:
          target.type === "EMERGENCY_STOP"
            ? "EMERGENCY STOP CONFIRMED"
            : "MANUAL CONTROL CONFIRMED",
        subMessage: target.message || "Situational awareness confirmed.",
        actor: "ATC-Controller",
      });
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col h-[65%] glass-panel rounded-xl p-0 relative overflow-hidden shrink-0 border-accent-red/20 shadow-[0_0_15px_rgba(255,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 border-b border-white/10 bg-white/5">
        <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-accent-red" />
          Approval Queue
          {alerts.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </h2>
        {alerts.length > 0 && (
          <div className="h-2 w-2 rounded-full bg-accent-red animate-ping" />
        )}
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {alerts.length === 0 && !pathOptionsData && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-xs text-center">
            <CheckCircle className="w-8 h-8 mb-2" />
            NO PENDING ACTIONS
          </div>
        )}



        {/* [NEW] 경로 승인 UI */}
        {pathOptionsData && (
          <div className="p-3 rounded border border-purple-500/40 bg-purple-500/5 animate-in slide-in-from-left-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <Route className="w-3 h-3" />
                CONFIRM ROUTE
              </h3>
              <button
                onClick={() => setPathOptionsData(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mb-3 font-mono">
              <span>FLIGHT: <span className="text-white">{pathOptionsData.flightNumber}</span></span>
              <div className="mt-1">
                <span className="text-purple-400">{pathOptionsData.departNode}</span>
                <span className="mx-2">→</span>
                <span className="text-purple-400">{pathOptionsData.destNode}</span>
              </div>
            </div>

            {/* Path Options */}
            <div className="space-y-2 mb-3">
              {pathOptionsData.pathOptions.map((option) => (
                <button
                  key={option.optionId}
                  onClick={() => setSelectedPath(option)}
                  className={cn(
                    "w-full p-2 text-left rounded border transition-all",
                    selectedPath?.optionId === option.optionId
                      ? "bg-purple-500/20 border-purple-400 ring-2 ring-purple-400/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-white">{option.label}</span>
                    <span className="text-[9px] text-gray-500">{option.edgeIds.length} edges</span>
                  </div>
                  <div className="text-[9px] text-gray-400 mt-1 font-mono truncate">
                    {option.edgeIds.slice(0, 3).join(" → ")}
                    {option.edgeIds.length > 3 && "..."}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleRouteConfirm}
              disabled={!selectedPath}
              className={cn(
                "w-full py-2 text-[11px] font-bold rounded transition-all uppercase",
                selectedPath
                  ? "bg-purple-500 text-white hover:bg-purple-400"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              )}
            >
              {selectedPath ? "Confirm Route" : "Select a route"}
            </button>
          </div>
        )}

        {alerts.map((alert) => {
          const isMission = alert.type === "MISSION_REQUEST";
          const isEmergency =
            alert.type === "EMERGENCY_STOP" || alert.type === "MANUAL_CONTROL";

          const borderClass = isMission
            ? "border-accent-cyan/40"
            : "border-accent-orange/40";
          const bgClass = isMission
            ? "bg-accent-cyan/5 hover:bg-accent-cyan/10"
            : "bg-accent-orange/5 hover:bg-accent-orange/10";
          const textClass = isMission
            ? "text-accent-cyan"
            : "text-accent-orange";

          return (
            <div
              key={alert.id}
              className={cn(
                "p-3 rounded border relative overflow-hidden group transition-all animate-in slide-in-from-left-2 duration-300",
                borderClass,
                bgClass,
              )}
            >
              {/* Time Badge */}
              <div className="absolute top-0 right-0 p-1.5">
                <span
                  className={cn("text-[9px] font-mono opacity-70", textClass)}
                >
                  {new Date(alert.timestamp).toLocaleTimeString([], {
                    hour12: false,
                  })}
                </span>
              </div>

              {/* Title & Icon */}
              <h3
                className={cn(
                  "text-sm font-bold mb-1 flex items-center gap-2 text-white",
                )}
              >
                {isMission && <Radio className={cn("w-3 h-3", textClass)} />}
                {alert.type === "MANUAL_CONTROL" && (
                  <Bell className={cn("w-3 h-3", textClass)} />
                )}
                {alert.type === "EMERGENCY_STOP" && (
                  <TriangleAlert className={cn("w-3 h-3", textClass)} />
                )}

                <span className={textClass}>
                  {alert.type === "MISSION_REQUEST" && "PUSHBACK REQUEST"}
                  {alert.type === "MANUAL_CONTROL" && "MANUAL OVERRIDE"}
                  {alert.type === "EMERGENCY_STOP" && "EMERGENCY STOP"}
                </span>
              </h3>

              {/* Content Body */}
              <div className="text-[11px] text-gray-400 leading-tight mb-3 pl-1 font-mono">
                {isMission ? (
                  <>
                    <div className="flex justify-between">
                      <span>
                        FLIGHT:{" "}
                        <span className="text-white">{alert.flightNumber}</span>
                      </span>
                      <span>
                        GATE:{" "}
                        <span className="text-white">{alert.currentGate}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-gray-500">
                      REQ: Dest{" "}
                      <span className="text-accent-cyan">
                        {alert.activeRunway || "N/A"}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-gray-300">
                    {alert.message ||
                      (alert.type === "EMERGENCY_STOP"
                        ? "Pilot triggered EMERGENCY STOP."
                        : "Manual control engaged by pilot.")}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isMission ? (
                  <>
                    <button
                      onClick={() => handleDecision(alert, true)}
                      className="flex-1 py-1.5 bg-accent-cyan/10 border border-accent-cyan/50 text-accent-cyan text-[10px] font-bold rounded hover:bg-accent-cyan hover:text-black transition-all uppercase"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(alert, false)}
                      className="flex-1 py-1.5 bg-transparent border border-red-500/30 text-red-500 text-[10px] font-bold rounded hover:bg-red-500/10 transition-colors uppercase"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConfirm(alert.id)}
                    className="flex-1 py-1.5 bg-accent-orange/10 border border-accent-orange/50 text-accent-orange text-[10px] font-bold rounded hover:bg-accent-orange hover:text-black transition-all uppercase"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DEBUG: Temporary Testing Controls */}
      {import.meta.env.DEV && (
        <div className="p-2 border-t border-white/10 flex gap-2 justify-center opacity-50 hover:opacity-100 transition-opacity flex-wrap">
          <button
            onClick={() =>
              setAlerts((prev) => [
                {
                  id: Date.now().toString(),
                  type: "MANUAL_CONTROL",
                  message: "Pilot requested MANUAL CONTROL",
                  timestamp: Date.now(),
                },
                ...prev,
              ])
            }
            className="text-[10px] bg-accent-orange/20 text-accent-orange px-2 py-1 rounded"
          >
            [TEST] Manual
          </button>
          <button
            onClick={() =>
              setAlerts((prev) => [
                {
                  id: Date.now().toString(),
                  type: "EMERGENCY_STOP",
                  message: "EMERGENCY STOP TRIGGERED",
                  timestamp: Date.now(),
                },
                ...prev,
              ])
            }
            className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded"
          >
            [TEST] Emergency
          </button>
          <button
            onClick={() =>
              setAlerts((prev) => [
                {
                  id: Date.now().toString(),
                  type: "MISSION_REQUEST",
                  flightNumber: "KE123",
                  currentGate: "T1-105",
                  activeRunway: "RUNWAY_34L",
                  flightId: 101,
                  timestamp: Date.now(),
                },
                ...prev,
              ])
            }
            className="text-[10px] bg-accent-cyan/20 text-accent-cyan px-2 py-1 rounded"
          >
            [TEST] Request
          </button>

          <button
            onClick={() =>
              setPathOptionsData({
                flightId: 101,
                flightNumber: "KE123",
                departNode: "T1-105",
                destNode: "RUNWAY_34L",
                pathOptions: [
                  { optionId: 1, label: "최적 경로", edgeIds: ["E1", "E2", "E3"] },
                  { optionId: 2, label: "대안 경로 1", edgeIds: ["E1", "E4", "E5", "E3"] },
                  { optionId: 3, label: "대안 경로 2", edgeIds: ["E6", "E7", "E8", "E9", "E3"] },
                ],
              })
            }
            className="text-[10px] bg-purple-500/20 text-purple-500 px-2 py-1 rounded"
          >
            [TEST] PathOptions
          </button>
        </div>
      )}
    </div>
  );
}
