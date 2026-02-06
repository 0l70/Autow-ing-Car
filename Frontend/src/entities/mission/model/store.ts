import { create } from 'zustand';
import { FlightInfo } from '@/features/dashboard/model/dashboardTypes';

export interface MissionInfo {
  flightNumber: string;
  destNode: string;
  status: string;
  departNode?: string;
  edgeIds?: string[];  // [NEW] Path edges for visualization
}

interface MissionState {
  activeMissions: Record<string, MissionInfo>;
  flightInfo: FlightInfo | null;
  
  // Actions
  ingest: (towingCarCode: string, info: MissionInfo) => void;
  setAllMissions: (missions: Record<string, MissionInfo>) => void;
  clearMission: (towingCarCode: string) => void;
  setFlightInfo: (info: FlightInfo | null) => void;
}


export const useMissionStore = create<MissionState>((set) => ({
  activeMissions: {},
  flightInfo: null,

  ingest: (towingCarCode, info) => set((state) => ({
    activeMissions: {
      ...state.activeMissions,
      [towingCarCode]: info
    }
  })),

  setAllMissions: (missions) => set({ activeMissions: missions }),

  clearMission: (towingCarCode) => set((state) => {
    const next = { ...state.activeMissions };
    delete next[towingCarCode];
    return { activeMissions: next };
  }),

  setFlightInfo: (info) => set({ flightInfo: info }),
}));
