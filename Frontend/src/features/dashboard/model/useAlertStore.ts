import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdminAlertDto } from './alert.types';

interface AlertState {
  alerts: AdminAlertDto[];
  addAlert: (alert: AdminAlertDto) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set) => ({
      alerts: [],
      addAlert: (alert) => set((state) => {
        // Prevent duplicates if needed (optional)
        if (state.alerts.some(a => a.id === alert.id)) return state;
        return { alerts: [...state.alerts, alert] };
      }),
      removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter((alert) => alert.id !== id),
      })),
      clearAlerts: () => set({ alerts: [] }),
    }),
    {
      name: 'atc-alerts-storage', // unique name for localStorage
    }
  )
);
