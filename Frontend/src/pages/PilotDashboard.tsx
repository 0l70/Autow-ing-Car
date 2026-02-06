import { usePilotController } from "@/features/pilot-actions/model/usePilotController";
import { useAircraftStore } from "@/entities/aircraft"; 
import { PilotCommandBar } from "@/features/pilot-actions/ui/PilotCommandBar";
import { PilotStatusPanel } from "@/features/pilot-actions/ui/PilotStatusPanel";
import { TowingCarInfo } from "@/features/pilot-actions/ui/TowingCarInfo";
import { PilotSafetyLock } from "@/features/pilot-actions/ui/PilotSafetyLock";
import { PilotTimeline } from "@/features/pilot-actions/ui/PilotTimeline";
import { PilotConfirmModal } from "@/features/pilot-actions/ui/PilotConfirmModal";
import { PilotWelcomeModal } from "@/features/pilot-actions/ui/PilotWelcomeModal";
import { CameraWidget } from "@/widgets/camera-panel/ui/CameraWidget";
import { PilotMapWidget } from "@/widgets/pilot-map/ui/PilotMapWidget"; 

export function PilotDashboard() {
    // 1. Logic Binding
    const { state, controls } = usePilotController();

    // 2. Data Integration (Live Store)
    const aircrafts = useAircraftStore(state => state.aircrafts);
    
    // Find MY assigned car from the store data
    const activeCarId = state.flightInfo?.assignedCarId;
    const assignedAircraft = activeCarId ? aircrafts.find(a => a.id === activeCarId) || null : null;
    const myAircraft = (assignedAircraft && 
                        assignedAircraft.status !== 'IDLE' && 
                        assignedAircraft.status !== 'UNLOADING') 
                        ? assignedAircraft 
                        : null;

    return (
        <div className="h-full w-full bg-black/50 p-4 text-slate-200 font-mono overflow-hidden flex flex-col gap-[2%] relative">
            <div className="grid grid-cols-12 gap-4 h-[58%] min-h-0">
                <CameraWidget 
                    className="col-span-5 h-full overflow-hidden" 
                    carId={state.flightInfo?.assignedCarId || ''} 
                />
                <PilotMapWidget 
                    className="col-span-5 h-full overflow-hidden" 
                    assignedCarId={state.flightInfo?.assignedCarId}
                />
                <PilotTimeline logs={state.logs} />
            </div>

            <div className="grid grid-cols-12 gap-4 h-[38%] min-h-0 shrink-0">
                <PilotCommandBar 
                    moveState={state.move} 
                    connState={state.connection}
                    moveLongPress={controls.moveLongPress}
                    connLongPress={controls.connLongPress}
                />
                <PilotStatusPanel aircraft={myAircraft} /> 
                <TowingCarInfo moveState={state.move} aircraft={myAircraft} />
                <PilotSafetyLock 
                    isAutoMode={state.isAutoMode}
                    modeLongPress={controls.modeLongPress}
                    handleEmergencyStop={controls.handleEmergencyStop}
                />
            </div>

            <PilotConfirmModal 
                isOpen={state.confirmModal.open}
                action={state.confirmModal.action}
                onConfirm={controls.handleConfirm}
                onCancel={controls.closeConfirmModal}
            />

            <PilotWelcomeModal
                isOpen={state.welcomeModal.open}
                data={state.flightInfo}
                onClose={controls.closeWelcomeModal}
            />
        </div>
    );
}
