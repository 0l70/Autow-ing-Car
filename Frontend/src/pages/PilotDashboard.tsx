import { useState } from 'react';

// --- Logic Hook ---
import { usePilotController } from "@/features/pilot-actions/model/usePilotController";

// --- UI Components ---
import { PilotCommandBar } from "@/features/pilot-actions/ui/PilotCommandBar";
import { PilotStatusPanel } from "@/features/pilot-actions/ui/PilotStatusPanel";
import { TowingCarInfo } from "@/features/pilot-actions/ui/TowingCarInfo";
import { PilotSafetyLock } from "@/features/pilot-actions/ui/PilotSafetyLock";
import { PilotTimeline } from "@/features/pilot-actions/ui/PilotTimeline";
import { PilotConfirmModal } from "@/features/pilot-actions/ui/PilotConfirmModal"; // [NEW]
import { PilotWelcomeModal } from "@/features/pilot-actions/ui/PilotWelcomeModal"; // [NEW]
import { CameraWidget } from "@/widgets/camera-panel/ui/CameraWidget";
import { PilotMapWidget } from "@/widgets/pilot-map/ui/PilotMapWidget"; 
import { useGraphStore } from "@/entities/map/model/store"; 

export function PilotDashboard() {
    // 1. Logic Binding (The "Brain")
    const { state, controls } = usePilotController(); // Dynamic Car ID

    // 2. Data Integration (Live Store)
    const { aircrafts } = useGraphStore();
    
    // Find MY assigned car from the store data
    // If flightInfo is not loaded yet or no car assigned, this will be undefined.
    const activeCarId = state.flightInfo?.assignedCarId;
    const myAircraft = activeCarId ? aircrafts.find(a => a.id === activeCarId) || null : null;

    return (
            <div className="h-full w-full bg-black/50 p-4 text-slate-200 font-mono overflow-hidden flex flex-col gap-4 relative">
                
                {/* --- TOP ROW (Visuals) --- */}
                <div className="grid grid-cols-12 gap-4 h-[60%]">
                    
                    {/* T1: Camera Widget */}
                    <CameraWidget 
                        className="col-span-5" 
                        carId={state.flightInfo?.assignedCarId || ''} 
                    />

                    {/* T2: Digital Twin Map Widget */}
                    <PilotMapWidget 
                        className="col-span-5"
                        // Selection removed: Map is for visualization only now
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
                    <PilotStatusPanel 
                        aircraft={myAircraft} 
                    /> 

                    {/* B3: Navigation Info */}
                    <TowingCarInfo moveState={state.move} aircraft={myAircraft} />

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

                {/* --- Welcome Modal (Flight Info) --- */}
                <PilotWelcomeModal
                    isOpen={state.welcomeModal.open}
                    data={state.flightInfo}
                    onClose={controls.closeWelcomeModal}
                />

            </div>
    );
}
