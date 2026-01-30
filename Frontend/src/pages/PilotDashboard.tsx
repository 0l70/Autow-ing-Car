import { useState, useCallback, useMemo } from 'react';

// --- Logic Hook ---
import { usePilotController } from "@/features/pilot-actions/model/usePilotController";

// --- UI Components ---
import { PilotCommandBar } from "@/features/pilot-actions/ui/PilotCommandBar";
import { PilotStatusPanel } from "@/features/pilot-actions/ui/PilotStatusPanel";
import { TowingCarInfo } from "@/features/pilot-actions/ui/TowingCarInfo";
import { PilotSafetyLock } from "@/features/pilot-actions/ui/PilotSafetyLock";
import { PilotTimeline } from "@/features/pilot-actions/ui/PilotTimeline";
import { PilotConfirmModal } from "@/features/pilot-actions/ui/PilotConfirmModal"; // [NEW]
import { CameraWidget } from "@/widgets/camera-panel/ui/CameraWidget";
import { PilotMapWidget } from "@/widgets/pilot-map/ui/PilotMapWidget"; 

// --- Map Integration (Removed direct imports) ---
import { Aircraft } from "@/entities/map/model/types";


export function PilotDashboard() {
    // 1. Logic Binding (The "Brain")
    const CAR_ID = 'CAR_102';
    const { state, controls } = usePilotController(CAR_ID);

    // 2. Map State (Simple Selection)
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);

    return (
            <div className="h-full w-full bg-black/50 p-4 text-slate-200 font-mono overflow-hidden flex flex-col gap-4 relative">
                
                {/* --- TOP ROW (Visuals) --- */}
                <div className="grid grid-cols-12 gap-4 h-[60%]">
                    
                    {/* T1: Camera Widget */}
                    <CameraWidget 
                        className="col-span-5" 
                        carId={CAR_ID} 
                    />

                    {/* T2: Digital Twin Map Widget */}
                    <PilotMapWidget 
                        className="col-span-5"
                        onAircraftSelect={setSelectedAircraft}
                    />

                    {/* T3: Logs */}
                    <PilotTimeline logs={state.logs} />
                </div>

                {/* --- BOTTOM ROW (Controls) --- */}
                <div className="grid grid-cols-12 gap-4 h-[40%]">
                    
                    {/* B1: Command Actions */}
                    <PilotCommandBar 
                        moveState={state.move} 
                        connState={state.connection}
                        moveLongPress={controls.moveLongPress}
                        connLongPress={controls.connLongPress}
                    />

                    {/* B2: Status */}
                    <PilotStatusPanel aircraft={selectedAircraft} /> 
                    {/* Note: Ideally 'selectedAircraft' should be MY aircraft. 
                        For now, linking to map selection is okay, but Phase 2 should lock it to CAR_102 
                    */}

                    {/* B3: Navigation Info */}
                    <TowingCarInfo moveState={state.move} aircraft={selectedAircraft} />

                    {/* B4: Safety */}
                    <PilotSafetyLock 
                        isAutoMode={state.isAutoMode}
                        modeLongPress={controls.modeLongPress}
                        handleEmergencyStop={controls.handleEmergencyStop}
                    />
                </div>

                {/* --- Confirmation Modal --- */}
                <PilotConfirmModal 
                    isOpen={state.confirmModal.open}
                    action={state.confirmModal.action}
                    onConfirm={controls.handleConfirm}
                    onCancel={controls.closeConfirmModal}
                />

            </div>
    );
}
