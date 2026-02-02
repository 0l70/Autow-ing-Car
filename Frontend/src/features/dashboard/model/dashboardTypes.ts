import { z } from 'zod';

export type MoveState = 'stopped' | 'moving' | 'pushback' | 'waiting';
export type ConnectionState = 'disconnected' | 'waiting' | 'connecting' | 'connected' | 'disconnecting';

// Flight Schedule Information (received via WebSocket)
export interface FlightInfo {
    flightId: number;
    flightNumber: string;
    pilotName: string;
    aircraftRegistrationNum: string; // 항공기 등록 번호 (예: HL7755)
    aircraftTypeCode: string;        // 항공기 기종 (예: B777)
    destination: string;
    departureTime?: string | null | undefined;
    gateNode?: string | null | undefined;
    assignedCarId?: string | null | undefined;
}

export const FlightInfoSchema = z.object({
    flightId: z.number(),
    flightNumber: z.string(),
    pilotName: z.string(),
    aircraftRegistrationNum: z.string(),
    aircraftTypeCode: z.string(),
    destination: z.string(),
    departureTime: z.string().nullish(),
    gateNode: z.string().nullish(),
    assignedCarId: z.string().nullish()
});
