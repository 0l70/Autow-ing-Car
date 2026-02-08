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

// [FSD] Import Types & Store
import { useAlertStore } from "./model/useAlertStore";
import { AdminAlertDto, PathOptionDto, PathOptionsResponseDto } from "./model/alert.types";

// [NEW] Use Aircraft Store for State Sync
import { useAircraftStore } from "@/entities/aircraft/model/store";
import { useGraphStore } from "@/entities/map/model/store";

// [NEW] Props definition
interface ApprovalQueueProps {
    onSelectAircraft?: (aircraftId: string) => void;
}

export function ApprovalQueue({ onSelectAircraft }: ApprovalQueueProps) {
  const { onMessage, send, isConnected } = useSocket() || {};
  
  // [FSD] Persistent Store
  const { alerts, addAlert, removeAlert } = useAlertStore();
  
  // [NEW] Aircraft State for Sync
  const aircrafts = useAircraftStore((state) => state.aircrafts);

  // Timeline Store
  const addLog = useTimelineStore((state) => state.addLog);

  // Local UI State (Workflow)
  const [pathOptionsData, setPathOptionsData] = useState<PathOptionsResponseDto | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathOptionDto | null>(null);

  // --- [NEW] State Synchronization Logic ---
  // If an aircraft is in ERROR/STOP state but no alert exists, create one.
  useEffect(() => {
    aircrafts.forEach(car => {
      // Check for Emergency conditions
      if (car.status === 'ERROR' || car.status === 'STOP') {
         // Check if alert already exists to prevent duplicate (spam)
         // We assume one active emergency alert per car is enough
         const exists = alerts.find(a => 
           (a.type === 'EMERGENCY_STOP' || a.type === 'MANUAL_CONTROL') && 
           a.flightNumber === car.callsign // or car.id
         );
         
         if (!exists) {
            console.log(`[ApprovalQueue] ⚠️ Detected silent emergency for ${car.callsign}. Synced alert.`);
            addAlert({
                id: `sync-alert-${Date.now()}-${car.id}`,
                type: 'EMERGENCY_STOP',
                message: `Synced: Vehicle ${car.callsign} is in ${car.status} state.`,
                severity: 'CRITICAL',
                timestamp: Date.now(),
                flightNumber: car.callsign, 
             });
         }
      }
    });
  // Check periodically or only when aircrafts change? 
  // 'aircrafts' changes frequently (telemetry), so we need to be careful not to spam.
  // 'addAlert' in store should handle duplicates if ID matches, but here we generate new ID.
  // We rely on the 'exists' check.
  }, [aircrafts, alerts, addAlert]);


  // --- WebSocket Subscription ---
  useEffect(() => {
    if (!onMessage) return;

    // Listen for All Controller Notifications (Requests + Emergencies)
    const unsubscribe = onMessage((msg: any) => {
      const { destination, body } = msg;

      // Ensure we listen to the correct topic constant
      if (destination === WS_TOPICS.CONTROLLER_REQUESTS) {
        const data = typeof body === 'string' ? JSON.parse(body) : body;
        console.log("[ApprovalQueue] Received Notification:", data);

        // CASE 1: Emergency / Manual Control Notif
        if (data.type === 'EMERGENCY_STOP' || data.type === 'MANUAL_CONTROL' || data.severity === 'emergency_stop') {
             addAlert({
                id: `alert-${Date.now()}`,
                type: data.type || (data.severity === "emergency_stop" ? "EMERGENCY_STOP" : "MANUAL_CONTROL"),
                message: data.message,
                severity: data.severity === "emergency_stop" ? "CRITICAL" : "WARNING",
                timestamp: Date.now(),
                flightNumber: data.flightNumber || data.carCode || "Unknown", // Backend sends flightNumber or carCode
                flightId: data.flightId, 
             });
        } 
        // CASE 2: Mission Request (Default)
        else {
             addAlert({
                ...data,
                type: "MISSION_REQUEST",
                id: data.id || `req-${Date.now()}`,
                timestamp: Date.now(),
             });
             addLog({
                type: "CONFIRM",
                message: `NEW REQUEST: ${data.flightNumber}`,
                subMessage: "Pilot requested pushback.",
                actor: "System",
             });
         }
       }
     });
 
     return () => unsubscribe();
   }, [onMessage, addAlert, addLog]);
 
   // --- Actions ---
   // ... existing handleDecision ...
   const handleDecision = async (
     alertItem: AdminAlertDto,
     approved: boolean,
   ) => {
     if (!alertItem.flightId) return;
 
     try {
       if (approved) {
         // [NEW] Sync Dashboard Selection to prevent clearing map
         if (onSelectAircraft && alertItem.flightNumber) {
            // Find aircraft by callsign (flightNumber)
            // Note: In our system callsign often equals flightNumber for assigned cars
            // Or we check which car is assigned to this flight. 
            // Simplified: Find aircraft with matching callsign or mission flight number.
            const targetCar = aircrafts.find(a => a.callsign === alertItem.flightNumber || a.currentMission?.flightNumber === alertItem.flightNumber);
            if (targetCar) {
                onSelectAircraft(targetCar.id);
            }
         }
 
         if (alertItem.pathOptions && alertItem.pathOptions.length > 0) {
           setPathOptionsData({
             flightId: alertItem.flightId,
             flightNumber: alertItem.flightNumber || "",
             departNode: alertItem.currentGate || "",
             destNode: alertItem.activeRunway || "", 
             pathOptions: alertItem.pathOptions,
             alertId: alertItem.id, // [NEW] Store Alert ID
           });
           
           addLog({
             type: "APPROVE",
             message: `PUSHBACK REQUEST ACCEPTED: ${alertItem.flightNumber}`,
             subMessage: `Opening path options...`,
             actor: "ATC-Controller",
           });
           // NOTE: Do NOT remove alert here. Wait for Route Confirmation.
         } else {
           window.alert("No path options available for this request.");
           return;
         }
       } else {
        if (send) {
          send(
            "SEND",
            { destination: WS_TOPICS.ATC.MISSION_DECIDE },
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
        
        // Remove only on rejection
        removeAlert(alertItem.id);
      }
    } catch (e) {
      console.error("Decision Failed", e);
      window.alert("Failed to send decision");
    }
  };

  const handleRouteConfirm = () => {
    if (!pathOptionsData || !selectedPath) return;

    if (send) {
      send(
        "SEND",
        { destination: WS_TOPICS.ATC.MISSION_DECIDE },
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

    // [NEW] Remove Alert NOW (after route confirmation)
    if (pathOptionsData.alertId) {
        removeAlert(pathOptionsData.alertId);
    }

    setPathOptionsData(null);
    setSelectedPath(null);
    useGraphStore.getState().setHighlightedPath([]); // [NEW] Clear Highlight
    useGraphStore.getState().setActiveDestinationNode(null); // [NEW] Clear Destination
  };

  const handleConfirm = (id: string) => {
    const target = alerts.find((a) => a.id === id);
    if (target) {
      addLog({
        type: "CONFIRM",
        message:
          target.type === "EMERGENCY_STOP"
            ? "EMERGENCY STOP ACKNOWLEDGED"
            : "MANUAL CONTROL ACKNOWLEDGED",
        subMessage: target.message || "ACKNOWLEDGED.",
        actor: "ATC-Controller",
      });
    }
    removeAlert(id);
  };

  return (
    <div className="flex flex-col h-[50%] glass-panel rounded-xl p-0 relative overflow-hidden shrink-0 border-accent-red/20 shadow-[0_0_15px_rgba(255,0,0,0.05)]">
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
                onClick={() => {
                    setPathOptionsData(null);
                    useGraphStore.getState().setHighlightedPath([]); // [NEW] Clear Highlight
                    useGraphStore.getState().setActiveDestinationNode(null); // [NEW] Clear Destination
                }}
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
                  onClick={() => {
                      setSelectedPath(option);
                      // [NEW] Trigger Map Highlight
                      useGraphStore.getState().setHighlightedPath(option.edgeIds || []);
                      // [NEW] Set Destination Marker
                      useGraphStore.getState().setActiveDestinationNode(pathOptionsData.destNode);
                  }}
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

        {alerts
        .filter((alert) => !pathOptionsData || alert.id !== pathOptionsData.alertId)
        .map((alert) => {
          const isMission = alert.type === "MISSION_REQUEST";
          
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
                    Acknowledged
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>


    </div>
  );
}
