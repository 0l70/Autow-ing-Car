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
