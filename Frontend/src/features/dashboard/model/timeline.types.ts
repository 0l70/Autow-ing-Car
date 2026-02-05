export type TimelineLogType = 'APPROVE' | 'REJECT' | 'CONFIRM' | 'INFO';

export interface TimelineItem {
  id: string;
  type: TimelineLogType;
  message: string;
  subMessage: string;
  actor: string;
  timestamp: number;
}
