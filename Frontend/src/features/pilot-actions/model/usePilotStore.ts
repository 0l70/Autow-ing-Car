import { create } from 'zustand';
import { FlightInfo } from "@/features/dashboard/model/dashboardTypes";

interface PilotStore {
    flightInfo: FlightInfo | null;
    setFlightInfo: (info: FlightInfo | null) => void;
}

export const usePilotStore = create<PilotStore>((set) => ({
    flightInfo: null,
    setFlightInfo: (info) => set({ flightInfo: info })
}));
