import { DashboardPage } from "@/pages/DashboardPage";
import { SocketProvider } from "@/shared/realtime/context/SocketProvider";

function App() {
  return (
    <SocketProvider>
      <DashboardPage />
    </SocketProvider>
  );
}

export default App;
