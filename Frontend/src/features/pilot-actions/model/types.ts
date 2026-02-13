export type MoveState = 'stopped' | 'waiting' | 'approved' | 'pushback' | 'moving' | 'paused';
export type ConnectionState = 'waiting' | 'connecting' | 'connected' | 'idle';

export interface PilotLog {
    id: number;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
}

export type PilotMode = 'MANUAL' | 'AUTO';

export interface PilotFlightInfo {
    flightId: number;
    flightNumber: string;
    airline: string;
    destination: string;
    gate: string;
    model: string; // Aircraft Model e.g. B737-800
}
