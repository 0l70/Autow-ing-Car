import { PilotPage } from "@/pages/PilotPage";
import { ControllerPage } from "@/pages/ControllerPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { AuthInitializer } from "@/features/auth/ui/AuthInitializer";
import { SocketProvider } from "@/shared/realtime/context/SocketProvider";

import { RootLayout } from "@/shared/ui/layout/RootLayout";
import { SocketBridge } from "@/app/providers/SocketBridge";

function AppContent() {
  const { isAuthenticated, user, accessToken } = useAuthStore();

  // 1. Guard: Ensure both Auth State and Tokens are ready
  // isAuthenticated may be true from localStorage, butaccessToken is memory-only.
  // AuthInitializer handles the restoration before we reach here.
  if (!isAuthenticated || !accessToken || !user) {
      return <LoginPage />;
  }

  // 2. Role-Based Routing
  return (
    <SocketProvider>
      <SocketBridge />
      <RootLayout>
        {user?.role === 'PILOT' ? (
            <PilotPage />
        ) : (
            <ControllerPage />
        )}
      </RootLayout>
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

