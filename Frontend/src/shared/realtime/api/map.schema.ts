import { z } from 'zod';

// --- Primitives ---
export const CoordinateSchema = z.object({
    x: z.number(),
    y: z.number(),
});

export const PixelCoordSchema = z.object({
    x: z.number(),
    y: z.number(),
});

// --- Map Graph Structures ---

export const MapNodeSchema = z.object({
    id: z.string(),
    x: z.number().describe('Metric X coordinate in local grid'),
    y: z.number().describe('Metric Y coordinate in local grid'),
    type: z.string().optional(),
});

export const MapEdgeSchema = z.object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
});

export const MapCornersSchema = z.object({
    TR: CoordinateSchema,
    TL: CoordinateSchema,
    BL: CoordinateSchema,
    BR: CoordinateSchema,
});

// --- Main Payloads ---

/**
 * Payload received from /topic/sys/map/info
 */
export const MapInfoPayloadSchema = z.object({
    map_id: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    corners: MapCornersSchema,
    nodes: z.array(MapNodeSchema),
    edges: z.array(MapEdgeSchema).optional().default([]),
});

export type MapNode = z.infer<typeof MapNodeSchema>;
export type MapEdge = z.infer<typeof MapEdgeSchema>;
export type MapCorners = z.infer<typeof MapCornersSchema>;
export type MapInfoPayload = z.infer<typeof MapInfoPayloadSchema>;
