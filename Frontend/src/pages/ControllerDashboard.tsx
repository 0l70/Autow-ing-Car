import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { AtcMapWidget } from "@/widgets/atc-map";
import { useMapData } from "@/features/map-visualizer/model/useMapData";

// [NEW] Stores for Destination Sync
import { useGraphStore } from "@/entities/map/model/store";
import { useMissionStore } from "@/entities/mission";
import { useAircraftStore } from "@/entities/aircraft";
import { useAlertStore } from "@/features/dashboard/model/useAlertStore";

export function ControllerDashboard() {
    // --- 1. Map Data Loading (Hook) ---
    useMapData();
    
    // --- 2. Store & Local State ---
    const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
    const { setActiveDestinationNode, setHighlightedPath } = useGraphStore();
    const activeMissions = useMissionStore(state => state.activeMissions);
    const aircrafts = useAircraftStore(state => state.aircrafts);
    const { alerts } = useAlertStore();

    // [Fix] Refined synchronization logic to prevent stale or premature pins
    const lastSelectedId = useRef<string | null>(null);
    const lastMissionStatus = useRef<string | undefined>(undefined);

    useEffect(() => {
        const aircraft = aircrafts.find(a => a.id === selectedAircraftId);
        const mission = selectedAircraftId ? activeMissions[selectedAircraftId] : null;

        const idChanged = lastSelectedId.current !== selectedAircraftId;
        const statusChanged = lastMissionStatus.current !== mission?.status;

        lastSelectedId.current = selectedAircraftId;
        lastMissionStatus.current = mission?.status;

        // Condition Check: Is there a pending approval request for this aircraft?
        const hasPendingAlert = alerts.some(a => 
            (a.flightNumber === aircraft?.callsign) && a.type === 'MISSION_REQUEST'
        );

        // [Fix] Case 0: Pending Alert detected -> Suppress all auto-sync
        // Clear any stale markers if the mission status just changed to RUNNING (init state)
        if (hasPendingAlert) {
             if (statusChanged) {
                 setActiveDestinationNode(null);
                 setHighlightedPath([]);
             }
             return; // Skip auto-mode while alert is active
        }

        // Case 1: No Selection or No Aircraft -> Clear All
        if (!selectedAircraftId || !aircraft) {
            setActiveDestinationNode(null);
            setHighlightedPath([]);
            return;
        }

        // Case 2: Aircraft Finished or Pre-Docking (IDLE / WAITING / UNDOCKING / MOVING_TO_GATE / DOCKING)
        // -> Explicit Clear All (High Priority)
        // This ensures the map stays clean while the tug is just arriving or finishing.
        const isFinishedOrArriving = 
            aircraft.status === 'IDLE' || 
            aircraft.status === 'WAITING_FOR_RETURN' || 
            aircraft.status === 'UNDOCKING' ||
            aircraft.status === 'MOVING_TO_GATE' ||
            aircraft.status === 'DOCKING';

        if (isFinishedOrArriving) {
             setActiveDestinationNode(null);
             setHighlightedPath([]);
             return;
        }

        // Case 3: Mission is actively RUNNING and NO pending alerts -> Force Sync (Auto-mode)
        // [Fix] Reinforce suppression: Even if RUNNING, do not auto-sync if we are still in the pre-approval phase (TOWING/STOP)
        // and haven't manually confirmed a path.
        if (!hasPendingAlert && mission?.status === 'RUNNING' && mission?.destNode) {
             const isWaitingForFirstMove = aircraft.status === 'TOWING' || aircraft.status === 'STOP';
             
             if (!isWaitingForFirstMove) {
                 setActiveDestinationNode(mission.destNode);
             } else {
                 // Explicitly clear during pre-approval to prevent premature markers from backend data
                 setActiveDestinationNode(null);
                 setHighlightedPath([]);
             }
        } 
        // Case 4: Selection Changed OR Status changed to something NOT Running -> Clear All
        else if (idChanged || (statusChanged && mission?.status !== 'RUNNING')) {
             setActiveDestinationNode(null);
             setHighlightedPath([]);
        }

    }, [selectedAircraftId, aircrafts, activeMissions, alerts, setActiveDestinationNode, setHighlightedPath]);

    // 4. Render
    return (
        <MainLayout
            leftPanel={<MissionInspector selectedAircraftId={selectedAircraftId} />}
            rightPanel={
                <>
                    <ApprovalQueue />
                    <ActivityTimeline />
                </>
            }
        >
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-black/20 overflow-hidden">
                    <AtcMapWidget 
                        className="w-full h-full" 
                        onAircraftSelect={setSelectedAircraftId}
                    />
                </div>
            </div>
        </MainLayout>
    );
}
