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
        // Match by either Aircraft Callsign OR Mission Flight Number
        const hasPendingAlert = alerts.some(a => 
            (a.flightNumber === aircraft?.callsign || a.flightNumber === mission?.flightNumber) && 
            a.type === 'MISSION_REQUEST'
        );

        // Case 1: No Selection or No Aircraft -> Clear All
        if (!selectedAircraftId || !aircraft) {
            setActiveDestinationNode(null);
            setHighlightedPath([]);
            return;
        }

        // Case 2: Handover logic - Clear ONLY when switching aircraft to avoid flickering
        if (idChanged) {
            setActiveDestinationNode(null);
            setHighlightedPath([]);
        }

        // Case 3: Aircraft Finished or Pre-Docking -> Clear All
        const isFinishedOrArriving = 
            aircraft.status === 'IDLE' || 
            aircraft.status === 'WAITING_FOR_RETURN' || 
            aircraft.status === 'UNDOCKING' ||
            aircraft.status === 'MOVING_TO_GATE' ||
            aircraft.status === 'DOCKING';

        if (isFinishedOrArriving && !hasPendingAlert) {
             setActiveDestinationNode(null);
             setHighlightedPath([]);
             return;
        }

        // Case 4: Mission is actively RUNNING -> Auto-Sync Map Visuals
        if (mission?.status === 'RUNNING' && mission?.destNode) {
             setActiveDestinationNode(mission.destNode);
             if (Array.isArray(mission.edgeIds)) {
                 setHighlightedPath(mission.edgeIds);
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
                    <ApprovalQueue onSelectAircraft={setSelectedAircraftId} />
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
