import { z } from 'zod';

/**
 * PGM Metadata Schema (YAML)
 * Ref: http://wiki.ros.org/map_server
 */
export const MapMetaSchema = z.object({
  image: z.string().describe("Filename of the map image (relative path)"),
  resolution: z.number().positive().describe("Map resolution in meters/pixel"),
  origin: z.tuple([z.number(), z.number(), z.number()]).describe("Pose of the lower-left pixel [x, y, theta]"),
  negate: z.union([z.number(), z.boolean()]).transform((val) => Boolean(val)).optional().default(0),
  occupied_thresh: z.number().optional().default(0.65),
  free_thresh: z.number().optional().default(0.196),
  mode: z.enum(['trinary', 'scale', 'raw']).optional().default('trinary'),
});

/**
 * Graph Node Types
 */
export const NodeTypeSchema = z.enum(['WAYPOINT', 'CHARGER', 'GATE', 'RUNWAY', 'INTERSECTION']);

/**
 * Graph Node Schema (JSON)
 */
export const GraphNodeSchema = z.object({
  id: z.string().describe("Unique Node ID"),
  x: z.number().describe("World X Coordinate (Meters)"),
  y: z.number().describe("World Y Coordinate (Meters)"),
  type: NodeTypeSchema.default('WAYPOINT'),
  label: z.string().optional(),
});

/**
 * Graph Edge Schema (JSON)
 */
export const GraphEdgeSchema = z.object({
  id: z.string().describe("Unique Edge ID"),
  fromId: z.string(),
  toId: z.string(),
  cost: z.number().positive().describe("Euclidean distance or weighted cost"),
  bidirectional: z.boolean().default(true),
  waypoints: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).nullable().optional().default([]),
});

/**
 * Full Graph Data Schema
 */
export const GraphDataSchema = z.object({
  version: z.string().optional().default("1.0"),
  lastModified: z.number().optional(), // Epoch ms
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
