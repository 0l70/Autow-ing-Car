import { PilotDashboard } from "@/pages/PilotDashboard";

export function PilotPage() {

    // 2. Render Pilot Dashboard (which uses its own PilotSocket)
    // Note: Global Telemetry Socket is NOT used here to prevent duplication.
    return (
        <PilotDashboard />
    );
}
