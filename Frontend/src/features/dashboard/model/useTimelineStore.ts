import { create } from 'zustand';

export interface TimelineItem {
  id: string;
  type: 'APPROVE' | 'REJECT' | 'CONFIRM';
  message: string;
  subMessage: string;
  actor: string;
  timestamp: number;
}

interface TimelineState {
  logs: TimelineItem[];
  addLog: (log: Omit<TimelineItem, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
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
}));
