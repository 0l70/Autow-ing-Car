import { MapMeta, PixelCoord, WorldCoord } from "../model/types";

/**
 * Converts World Coordinates (Meters) to Pixel Coordinates (Grid)
 * NOTE: PGM origin is usually bottom-left, but Canvas is top-left. 
 * We must handle Y-axis inversion.
 * 
 * @param world - World coordinate {x, y} in meters
 * @param meta - Map metadata (resolution, origin)
 * @param imageHeight - Height of the map image in pixels
 * @returns Pixel coordinate {x, y}
 */
export function worldToPixel(world: WorldCoord, meta: MapMeta, imageHeight: number): PixelCoord {
    const originX = meta.origin[0];
    const originY = meta.origin[1];
    
    // Fix: If RAW mode (Abstract Grid), use 1:1 mapping (ignore resolution scaling)
    const isRaw = meta.mode === 'raw' || (meta as any).mode === 'abstract';
    const effectiveRes = isRaw ? 1.0 : meta.resolution;

    // 1. Calculate grid coordinates (bottom-left origin)
    const mapX = (world.x - originX) / effectiveRes;
    const mapY = (world.y - originY) / effectiveRes;

    // Fix: Raw mode usually means "Screen Coordinates" (Top-Left Origin) already.
    // If we invert Y, we might be flipping it unnecessarily or misaligning it.
    if (isRaw) {
        return { x: mapX, y: mapY };
    }

    // 2. Invert Y for Canvas (top-left origin)
    return {
        x: mapX,
        y: imageHeight - mapY
    };
}

/**
 * Converts Pixel Coordinates (Grid) to World Coordinates (Meters)
 * 
 * @param pixel - Pixel coordinate {x, y} from Canvas
 * @param meta - Map metadata
 * @param imageHeight - Height of the map image in pixels
 * @returns World coordinate {x, y} in meters
 */
export function pixelToWorld(pixel: PixelCoord, meta: MapMeta, imageHeight: number): WorldCoord {
    const originX = meta.origin[0];
    const originY = meta.origin[1];
    const resolution = meta.resolution;

    // 1. Revert Y inversion (Back to bottom-left origin)
    const mapX = pixel.x;
    const mapY = imageHeight - pixel.y;

    // 2. Convert to meters
    // world_x = (grid_x * resolution) + origin_x
    return {
        x: (mapX * resolution) + originX,
        y: (mapY * resolution) + originY
    };
}
