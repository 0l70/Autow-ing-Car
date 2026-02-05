export type NotificationType = "MISSION_REQUEST" | "MANUAL_CONTROL" | "EMERGENCY_STOP";

export interface PathOptionDto {
  optionId: number;
  label: string;
  edgeIds: string[];
}

export interface AdminAlertDto {
  // Common Fields
  id: string; // React key (e.g., 'req-12345')
  type: NotificationType;
  timestamp: number;
  message?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";

  // Mission Specific
  flightId?: number;
  flightNumber?: string;
  pilotId?: string;
  currentGate?: string;
  activeRunway?: string;
  pathOptions?: PathOptionDto[];
}

export interface PathOptionsResponseDto {
  flightId: number;
  flightNumber: string;
  departNode: string;
  destNode: string;
  pathOptions: PathOptionDto[];
  alertId: string;
}
