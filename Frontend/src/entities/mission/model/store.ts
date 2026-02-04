import { create } from 'zustand';

export interface MissionInfo {
  flightNumber: string;
  destNode: string;
  status: string;
  departNode?: string;
}

interface MissionState {
  activeMissions: Record<string, MissionInfo>;
  
  // Ingest: Pure update interface
  ingest: (towingCarCode: string, info: MissionInfo) => void;
  clearMission: (towingCarCode: string) => void;
}

export const useMissionStore = create<MissionState>((set) => ({
  activeMissions: {},

  ingest: (towingCarCode, info) => set((state) => ({
    activeMissions: {
      ...state.activeMissions,
      [towingCarCode]: info
    }
  })),

  clearMission: (towingCarCode) => set((state) => {
    const next = { ...state.activeMissions };
    delete next[towingCarCode];
    return { activeMissions: next };
  }),
}));
