import { create } from 'zustand';

interface SyncState {
  isMapLoaded: boolean;
  isMissionLoaded: boolean;
  isAircraftLoaded: boolean;
  isPilotInfoLoaded: boolean;
  
  // Overall sync status
  isInitialSyncComplete: boolean;

  // Actions
  setMapLoaded: (loaded: boolean) => void;
  setMissionLoaded: (loaded: boolean) => void;
  setAircraftLoaded: (loaded: boolean) => void;
  setPilotInfoLoaded: (loaded: boolean) => void;
  setSyncComplete: (complete: boolean) => void;
  
  resetSync: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isMapLoaded: false,
  isMissionLoaded: false,
  isAircraftLoaded: false,
  isPilotInfoLoaded: false,
  isInitialSyncComplete: false,

  setMapLoaded: (loaded) => set({ isMapLoaded: loaded }),
  setMissionLoaded: (loaded) => set({ isMissionLoaded: loaded }),
  setAircraftLoaded: (loaded) => set({ isAircraftLoaded: loaded }),
  setPilotInfoLoaded: (loaded) => set({ isPilotInfoLoaded: loaded }),
  setSyncComplete: (complete) => set({ isInitialSyncComplete: complete }),

  resetSync: () => set({
    isMapLoaded: false,
    isMissionLoaded: false,
    isAircraftLoaded: false,
    isPilotInfoLoaded: false,
    isInitialSyncComplete: false
  })
}));
