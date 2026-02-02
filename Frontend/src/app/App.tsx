import { PilotPage } from "@/pages/PilotPage";
import { ControllerPage } from "@/pages/ControllerPage";
import { LoginPage } from "@/features/auth/ui/LoginPage";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import { SocketProvider } from "@/shared/realtime/context/SocketProvider";

import { RootLayout } from "@/shared/ui/layout/RootLayout";

function App() {
  const { isAuthenticated, user } = useAuthStore();

  // 1. Auth Guard
  if (!isAuthenticated) {
      return <LoginPage />;
  }

  // 2. Role-Based Routing
  return (
    <SocketProvider>
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

export default App;
