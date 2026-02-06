import { z } from 'zod';
import { GraphDataSchema, GraphEdgeSchema, GraphNodeSchema, MapMetaSchema, NodeTypeSchema } from './schema';

// Inferred Types from Zod Schemas
export type MapMeta = z.infer<typeof MapMetaSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;

// Internal Types for Coordinate System
export interface PixelCoord {
    x: number;
    y: number;
}

export interface WorldCoord {
    x: number;
    y: number;
}

// --- Aircraft / Agent Types (Aligned with MQTT v1.1) ---

// MQTT: IDLE | MOVING_TO_GATE | DOCKING | TOWING | UNDOCKING | WAITING_FOR_RETURN | RETURNING | STOP | ERROR
export type AircraftStatus = 'IDLE' | 'MOVING_TO_GATE' | 'DOCKING' | 'TOWING' | 'UNDOCKING' | 'WAITING_FOR_RETURN' | 'RETURNING' | 'STOP' | 'ERROR';

export interface Aircraft {
    id: string;             // MQTT: {carId}
    callsign: string;       // e.g., "TC01"
    type: 'TUG' | 'B737';   // Type
    position: {
        x: number;          // MQTT: x_m
        y: number;          // MQTT: y_m
        r: number;          // MQTT: yaw_deg -> Stored directly as Degrees (0-360) for UI
    };
    status: AircraftStatus; // MQTT: mode
    battery: number;        // MQTT: battery_pct
    speed: number;          // MQTT: velocity_mps
    currentMission?: string; // MQTT: current_mission (e.g. "DOCKING_A")
    isLoaded: boolean;      // MQTT: is_loaded
}
