import { create } from 'zustand';
import { Aircraft } from '@/entities/map/model/types';

interface AircraftState {
  aircrafts: Aircraft[];
  lastUpdate: number;
  
  // Ingest: Pure update interface for the infrastructure
  ingest: (data: Aircraft) => void;
  setAllAircrafts: (list: Aircraft[]) => void;
}


export const useAircraftStore = create<AircraftState>((set) => ({
  aircrafts: [],
  lastUpdate: 0,

  ingest: (data) => set((state) => {
    const exists = state.aircrafts.find(a => a.id === data.id);
    const now = Date.now();
    
    // Logic for Telemetry Batching can be added here or in a separate hook
    if (exists) {
      return {
        aircrafts: state.aircrafts.map(a => a.id === data.id ? { ...a, ...data } : a),
        lastUpdate: now
      };
    } else {
      return {
        aircrafts: [...state.aircrafts, data],
        lastUpdate: now
      };
    }
  }),

  setAllAircrafts: (list) => set({ aircrafts: list, lastUpdate: Date.now() }),
}));

