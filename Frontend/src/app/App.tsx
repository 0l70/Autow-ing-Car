import { PilotPage } from "@/pages/PilotPage";
import { ControllerPage } from "@/pages/ControllerPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { AuthInitializer } from "@/features/auth/ui/AuthInitializer";
import { useSyncStore } from "@/shared/model/syncStore";
import { LoadingSplash } from "@/shared/ui/LoadingSplash";

import { SocketProvider } from "@/shared/realtime/context/SocketProvider";

import { RootLayout } from "@/shared/ui/layout/RootLayout";
import { SocketBridge } from "@/app/providers/SocketBridge";
import { PilotInitializer } from "@/features/dashboard/ui/PilotInitializer";


function AppContent() {
  const { isAuthenticated, user, accessToken } = useAuthStore();
  const { isInitialSyncComplete } = useSyncStore();

  // 1. Auth Guard (Restoration handled by AuthInitializer)
  if (!isAuthenticated || !accessToken || !user) {
      return <LoginPage />;
  }

  // 2. Global Sync Guard: Wait for core data (Map, Missions, TowingCars)
  // This prevents UI flicker or empty states on refresh.
  return (
    <SocketProvider>
      <SocketBridge />
      {!isInitialSyncComplete ? (
        <LoadingSplash message="Synchronizing Realtime Data..." />
      ) : (
        <RootLayout>
          {user?.role === 'PILOT' ? (
              <PilotInitializer>
                  <PilotPage />
              </PilotInitializer>
          ) : (
              <ControllerPage />
          )}
        </RootLayout>
      )}
    </SocketProvider>
  );
}



function App() {
  return (
    <AuthInitializer>
      <AppContent />
    </AuthInitializer>
  );
}

export default App;

