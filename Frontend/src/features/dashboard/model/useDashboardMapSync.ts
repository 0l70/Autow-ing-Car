import { useEffect, useRef } from "react";
import { useGraphStore } from "@/entities/map/model/store";
import { useMissionStore } from "@/entities/mission";
import { useAircraftStore } from "@/entities/aircraft";
import { useAlertStore } from "@/features/dashboard/model/useAlertStore";

/**
 * [FSD] Dashboard Map Synchronization Hook
 * Syncs the selected aircraft's mission state to the global Map Store.
 * Handles performance optimizations (caching) and logic conflicts (pending alerts).
 */
export function useDashboardMapSync(selectedAircraftId: string | null) {
    const { 
        setActiveDestinationNode, 
        setHighlightedPath, 
        activeDestinationNodeId, 
        highlightedPath 
    } = useGraphStore();
    
    const activeMissions = useMissionStore(state => state.activeMissions);
    const aircrafts = useAircraftStore(state => state.aircrafts);
    const { alerts } = useAlertStore();

    // Refs for Change Detection (Logic)
    const lastSelectedId = useRef<string | null>(null);
    const lastMissionStatus = useRef<string | undefined>(undefined);

    // Refs for Performance Caching (Prevent Redundant Store Updates)
    const lastSyncedDest = useRef<string | null>(null);
    const lastSyncedPath = useRef<string[]>([]);

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

        // Case 1: No Selection or No Aircraft
        if (!selectedAircraftId || !aircraft) {
            // [Fix] Do NOT clear if there is a pending alert (Preview Mode)
            if (!hasPendingAlert) {
                if (activeDestinationNodeId !== null || highlightedPath.length > 0) {
                     setActiveDestinationNode(null);
                     setHighlightedPath([]);
                }
            }
            lastSyncedDest.current = null;
            lastSyncedPath.current = [];
            return;
        }

        // Case 2: Handover logic - Clear ONLY when switching aircraft to avoid flickering
        if (idChanged) {
            setActiveDestinationNode(null);
            setHighlightedPath([]);
            lastSyncedDest.current = null;
            lastSyncedPath.current = [];
        }

        // Case 3: Aircraft Finished or Pre-Docking -> Clear All
        const isFinishedOrArriving = 
            aircraft.status === 'IDLE' || 
            aircraft.status === 'WAITING_FOR_RETURN' || 
            aircraft.status === 'UNDOCKING' ||
            aircraft.status === 'MOVING_TO_GATE' ||
            aircraft.status === 'DOCKING';

        if (isFinishedOrArriving && !hasPendingAlert) {
             if (activeDestinationNodeId !== null) setActiveDestinationNode(null);
             if (highlightedPath.length > 0) setHighlightedPath([]);
             
             lastSyncedDest.current = null;
             lastSyncedPath.current = [];
             return;
        }

        // Case 4: Mission is actively RUNNING -> Auto-Sync Map Visuals
        // [Fix] Do NOT auto-sync if there is a pending alert (User is likely previewing a new path)
        if (mission?.status === 'RUNNING' && mission?.destNode && !hasPendingAlert) {
             // Optimize: Only dispatch if value actually changed
             if (lastSyncedDest.current !== mission.destNode) {
                 setActiveDestinationNode(mission.destNode);
                 lastSyncedDest.current = mission.destNode;
             }

             if (Array.isArray(mission.edgeIds)) {
                 // Check if path array content changed (Simple join check)
                 const pathStr = mission.edgeIds.join(',');
                 const lastPathStr = lastSyncedPath.current.join(',');
                 
                 if (pathStr !== lastPathStr) {
                     setHighlightedPath(mission.edgeIds);
                     lastSyncedPath.current = mission.edgeIds;
                 }
             }
        }
        // Case 5: Selection Changed OR Status changed to something NOT Running -> Clear All
        else if (idChanged || (statusChanged && mission?.status !== 'RUNNING' && !hasPendingAlert)) {
             setActiveDestinationNode(null);
             setHighlightedPath([]);
             lastSyncedDest.current = null;
             lastSyncedPath.current = [];
        }

    }, [
        selectedAircraftId, 
        aircrafts, 
        activeMissions, 
        alerts, 
        setActiveDestinationNode, 
        setHighlightedPath, 
        activeDestinationNodeId, 
        highlightedPath
    ]);
}
