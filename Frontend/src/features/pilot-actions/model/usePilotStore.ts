import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MoveState, ConnectionState, PilotMode, PilotLog } from './pilot.types';

interface PilotState {
  // Persistent States
  moveState: MoveState;
  isAutoMode: boolean; // Persist Auto Mode selection
  
  // Non-Persistent States (or arguably persistent, but connection usually resets)
  connState: ConnectionState;
  logs: PilotLog[];

  // Actions
  setMoveState: (state: MoveState) => void;
  setConnState: (state: ConnectionState) => void;
  toggleAutoMode: () => void;
  setIsAutoMode: (isAuto: boolean) => void;
  addLog: (log: Omit<PilotLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const usePilotStore = create<PilotState>()(
  persist(
    (set) => ({
      moveState: 'stopped',
      isAutoMode: false,
      connState: 'idle', // Connection usually needs re-establishment logic on refresh
      logs: [],

      setMoveState: (state) => set({ moveState: state }),
      setConnState: (state) => set({ connState: state }),
      toggleAutoMode: () => set((state) => ({ isAutoMode: !state.isAutoMode })),
      setIsAutoMode: (isAuto) => set({ isAutoMode: isAuto }),
      
      addLog: (log) => set((state) => ({
        logs: [
          {
            ...log,
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
          },
          ...state.logs
        ]
      })),
      clearLogs: () => set({ logs: [] })
    }),
    {
      name: 'pilot-storage',
      partialize: (state) => ({ 
        moveState: state.moveState, // Only persist these
        isAutoMode: state.isAutoMode,
        // logs: state.logs // Optionally persist logs too? Maybe useful.
      }),
    }
  )
);
