import { useMemo } from 'react';
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, WorldCoord } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

interface GraphLayerProps {
  meta: MapMeta | null;
  mapHeight: number;
}

/**
 * 컴포넌트: 그래프 레이어 (뷰어 전용)
 * 노드와 엣지를 단순 표시합니다. (편집 기능 없음)
 */
export function GraphLayer({ meta, mapHeight }: GraphLayerProps) {
  const { nodes, edges, selectedId } = useGraphStore();
  const { offset, scale } = useMapCamera();

  // --- Engineered Path: Straight Lines with Rounded Corners (Fillets) ---
  const getRoundedPath = (rawPoints: { x: number; y: number }[], radius: number = MAP_CONFIG.GRAPH.EDGE.CORNER_RADIUS) => {
    // 1. Strict Input Validation (Filter NaNs)
    if (!rawPoints) return "";
    const points = rawPoints.filter(p => p && !isNaN(p.x) && !isNaN(p.y));

    // Safety check
    if (points.length < 2) return "";
    
    // Simple line for 2 points
    if (points.length === 2 && points[0] && points[1]) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    // Start Path
    if (!points[0]) return "";
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1]; // Previous
        const p1 = points[i];     // Current (Corner)
        const p2 = points[i + 1]; // Next

        // Validation to prevent "undefined" errors
        if (!p0 || !p1 || !p2) continue;

        // Vectors
        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };

        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        // Prevent division by zero
        if (len1 === 0 || len2 === 0) {
            d += ` L ${p1.x} ${p1.y}`;
            continue;
        }

        // Clamped Radius: Ensure we don't eat more than 45% of the segment
        // (Leaving a bit of gap prevents artifacts)
        const r = Math.min(radius, len1 * 0.45, len2 * 0.45);

        // Normalize & Scale to find Start/End of Curve
        const o1 = { x: p1.x + (v1.x / len1) * r, y: p1.y + (v1.y / len1) * r };
        const o2 = { x: p1.x + (v2.x / len2) * r, y: p1.y + (v2.y / len2) * r };

        if (isNaN(o1.x) || isNaN(o1.y) || isNaN(o2.x) || isNaN(o2.y)) {
             d += ` L ${p1.x} ${p1.y}`;
             continue;
        }

        d += ` L ${o1.x} ${o1.y}`;
        d += ` Q ${p1.x} ${p1.y} ${o2.x} ${o2.y}`;
    }

    // Connect to Final Point
    const last = points[points.length - 1];
    if (last) {
        d += ` L ${last.x} ${last.y}`;
    }

    return d;
  };

  if (!meta || mapHeight === 0) return null;

  const activeMeta = meta;
  const getPixel = (world: WorldCoord) =>
    worldToPixel(world, activeMeta, mapHeight);

  // Helper function to get all points for an edge
  const getPoints = (edge: typeof edges[number]) => {
    const fromNode = nodes.find((n) => n.id === edge.fromId);
    const toNode = nodes.find((n) => n.id === edge.toId);
    if (!fromNode || !toNode) return null;

    const p1 = getPixel(fromNode);
    const p2 = getPixel(toNode);
    const waypoints = edge.waypoints?.map((wp) => getPixel(wp)) || [];
    return [p1, ...waypoints, p2];
  };

  const selectedEdge = edges.find(e => e.id === selectedId);

  // [Deduplication Logic] 양방향 간선 중복 제거
  const uniqueEdges = useMemo(() => {
    const activeKeys = new Set<string>();
    const result: typeof edges = [];

    edges.forEach(edge => {
        // ID 정렬을 통해 방향과 관계없이 동일한 연결로 취급 (A-B == B-A)
        const key = [edge.fromId, edge.toId].sort().join('-');
        
        if (!activeKeys.has(key)) {
            activeKeys.add(key);
            result.push(edge);
        }
    });

    return result;
  }, [edges]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <filter id="neon-sharp" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="1.5" result="tightBlur" />
             <feMerge>
                <feMergeNode in="tightBlur" />
                <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            {/* --- Layer 1: Road Network (Unique Paths) --- */}
            <g>
            {uniqueEdges.map((edge) => { 
                const points = getPoints(edge);
                if (!points) return null;

                return (
                <g key={`road-${edge.id}`}>
                    {/* 1. Neon Glow (Bottom Layer - Blurred) */}
                    <path
                        d={getRoundedPath(points)}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.NEON_GLOW} 
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.GLOW} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: "blur(4px)", opacity: 0.6 }} 
                    />

                    {/* 2. Crisp Outline (Middle Layer - Solid) */}
                    <path
                        d={getRoundedPath(points)}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.OUTLINE} 
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.OUTLINE} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    
                    {/* 3. Road Core (Top Layer - Dark & Solid) */}
                    <path
                        d={getRoundedPath(points)}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.DEFAULT} 
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.CORE} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
                );
            })}
            </g>

            {/* --- Layer 2: Nodes (Points) --- */}
            {nodes.map(node => {
            // "WAYPOINT"는 시각적으로 숨기고 싶은 경우 아래 주석 해제 (지금은 모두 표시)
            // if (node.type === "WAYPOINT") return null; 

            const pos = getPixel(node);
            const isSelected = selectedId === node.id;
            
            const radius = isSelected 
                ? MAP_CONFIG.GRAPH.NODE.RADIUS.SELECTED_CORE 
                : MAP_CONFIG.GRAPH.NODE.RADIUS.NORMAL_CORE;

            // 타입별 색상 결정
            const typeColor = MAP_CONFIG.GRAPH.COLOR.NODE_TYPE[node.type as keyof typeof MAP_CONFIG.GRAPH.COLOR.NODE_TYPE] 
                              || MAP_CONFIG.GRAPH.COLOR.NODE;

            return (
                <g key={`node-${node.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
                    {/* 노드 포인트 (Achromatic with Border) */}
                    <circle 
                        r={radius} 
                        fill={isSelected ? MAP_CONFIG.GRAPH.COLOR.ACTIVE : typeColor} 
                        stroke={isSelected ? 'none' : MAP_CONFIG.GRAPH.COLOR.NODE_BORDER}
                        strokeWidth={isSelected ? 0 : MAP_CONFIG.GRAPH.NODE.STROKE_WIDTH}
                        style={isSelected ? { filter: "drop-shadow(0 0 5px #fff)" } : undefined}
                    />
                </g>
            );
            })}

            {/* --- Layer 3: Active Path (Laser Beam) --- */}
            {selectedEdge && (() => {
            const points = getPoints(selectedEdge);
            if (!points) return null;
            return (
                <g key={`tech-active-${selectedEdge.id}`}>
                {/* 1. Massive Flood Glow */}
                <path
                    d={getRoundedPath(points)}
                    fill="none"
                    stroke={MAP_CONFIG.GRAPH.COLOR.DEFAULT} 
                    strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ACTIVE_GLOW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.3}
                    style={{ filter: "blur(5px)" }}
                />
                {/* 2. Intense Beam */}
                <path
                    d={getRoundedPath(points)}
                    fill="none"
                    stroke={MAP_CONFIG.GRAPH.COLOR.DEFAULT}
                    strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ACTIVE_BEAM}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "blur(1px)" }}
                />
                {/* 3. White Hot Core - Solid */}
                <path
                    d={getRoundedPath(points)}
                    fill="none"
                    stroke={MAP_CONFIG.GRAPH.COLOR.ACTIVE} 
                    strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ACTIVE_CORE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={1}
                />
                </g>
            );
            })()}
        </g>
      </svg>
    </div>
  );
}
