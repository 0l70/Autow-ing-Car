import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TimelineItem } from './timeline.types';

interface TimelineState {
  logs: TimelineItem[];
  addLog: (log: Omit<TimelineItem, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (log) => set((state) => ({
        logs: [
          {
            ...log,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
          },
          ...state.logs,
        ],
      })),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'atc-timeline-storage', // Persistence Key
    }
  )
);
