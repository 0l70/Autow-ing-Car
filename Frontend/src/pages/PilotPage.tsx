import { PilotDashboard } from "@/pages/PilotDashboard";
import { useMapLoader } from "@/features/map-visualizer/model/useMapLoader";

export function PilotPage() {
    // 1. Load Background Map Data (Required for map widgets even if logic is separated)
    useMapLoader();

    // 2. Render Pilot Dashboard (which uses its own PilotSocket)
    // Note: Global Telemetry Socket is NOT used here to prevent duplication.
    return (
        <PilotDashboard />
    );
}
