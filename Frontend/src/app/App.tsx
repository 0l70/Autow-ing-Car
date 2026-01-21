import { useState } from "react";
import { DashboardPage } from "@/pages/DashboardPage";
import { MapEditorPage } from "@/pages/MapEditorPage";
import { Navbar } from "@/widgets/navigation/Navbar";

function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'editor'>('dashboard');

  return (
    <>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />
      
      {currentTab === 'dashboard' ? (
        <DashboardPage />
      ) : (
        <MapEditorPage />
      )}
    </>
  );
}

export default App;
