import { useMemo } from 'react';
import { GraphNode, MapMeta } from '@/entities/map/model/types';
import { MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { worldToPixel } from '@/entities/map/lib/coordinate';

interface ViewportOptions {
    paddingScale?: number; // 0.1 = 10% padding
    minPadding?: number;   // Minimum padding in meters
}

/**
 * Nodes 데이터를 기반으로 최적의 Viewport(Bounding Box)를 계산하는 Hook
 * FSD: Features layer (map-visualizer)
 * 
 * [Update] Returns PIXEL coordinates for MapCanvas, converted from World Meters.
 * [Update 2] Clamps result to keep within Map Bounds to avoid black void.
 */
export function useAutoViewport(
    nodes: GraphNode[], 
    meta: MapMeta | null,
    mapHeight: number,
    defaultWidth: number, 
    defaultHeight: number, 
    options: ViewportOptions = {}
) {
    const { paddingScale = 0.1, minPadding = 5 } = options;

    return useMemo(() => {
        // 1. 기본값 (노드가 없거나 메타데이터가 없는 경우)
        const fallback = {
            viewBox: {
                x: 0,
                y: 0,
                width: defaultWidth || MOCK_MAP_SIZE.width,
                height: defaultHeight || MOCK_MAP_SIZE.height
            },
            isEmpty: true
        };

        if (!nodes || nodes.length === 0 || !meta) {
            return fallback;
        }

        // 2. Min/Max 계산 (World Meters)
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // 3. Raw Size (Meters)
        const rawW = maxX - minX;
        const rawH = maxY - minY;

        // 4. Padding 계산 (Meters)
        const paddingX = Math.max(minPadding, rawW * paddingScale);
        const paddingY = Math.max(minPadding, rawH * paddingScale);

        // 5. Apply Padding to World Bounds
        // Viewport in Meters
        const worldLeft = minX - paddingX;
        const worldRight = maxX + paddingX;
        const worldBottom = minY - paddingY;
        const worldTop = maxY + paddingY;
        
        const worldWidth = worldRight - worldLeft;
        const worldHeight = worldTop - worldBottom;

        // 6. Convert to Pixels (Canvas Space)
        const topLeftPixel = worldToPixel({ x: worldLeft, y: worldTop }, meta, mapHeight);
        
        // Width/Height in Pixels
        const pixelWidth = worldWidth / meta.resolution;
        const pixelHeight = worldHeight / meta.resolution;

        // 7. Clamp to Map Bounds (Intersection Clamping) [User Answer Solution 2]
        // Ensure the viewBox stays strictly within the logical map size (0 to defaultWidth/Height)
        
        const mapPixelW = defaultWidth; 
        const mapPixelH = defaultHeight;

        // Calculate Intersection
        const destLeft = Math.max(0, topLeftPixel.x);
        const destTop = Math.max(0, topLeftPixel.y);
        const destRight = Math.min(mapPixelW, topLeftPixel.x + pixelWidth);
        const destBottom = Math.min(mapPixelH, topLeftPixel.y + pixelHeight);

        // Re-calculate W/H
        const finalX = destLeft;
        const finalY = destTop;
        const finalW = Math.max(0, destRight - destLeft);
        const finalH = Math.max(0, destBottom - destTop);

        return {
            viewBox: {
                x: finalX,
                y: finalY,
                width: finalW,
                height: finalH
            },
            isEmpty: false
        };
    }, [nodes, meta, mapHeight, defaultWidth, defaultHeight, paddingScale, minPadding]);
}
