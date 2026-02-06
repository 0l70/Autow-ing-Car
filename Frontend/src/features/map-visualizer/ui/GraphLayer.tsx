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

  // [Deduplication Logic] 양방향 간선 중복 제거
  const uniqueEdges = useMemo(() => {
    const activeKeys = new Set<string>();
    const result: typeof edges = [];

    edges.forEach(edge => {
        const key = [edge.fromId, edge.toId].sort().join('-');
        if (!activeKeys.has(key)) {
            activeKeys.add(key);
            result.push(edge);
        }
    });

    return result;
  }, [edges]);

    // [Path Merging Logic] 경로 병합 로직
    const mergedPathData = useMemo(() => {
        const highlightedPath = useGraphStore.getState().highlightedPath || [];
        if (highlightedPath.length === 0) return null;

        // 1. 순서대로 Edge 가져오기
        const pathEdges = highlightedPath
            .map(id => edges.find(e => e.id === id))
            .filter((e): e is typeof edges[number] => !!e);

        if (pathEdges.length === 0) return null;

        const points: WorldCoord[] = [];
        
        // Helper: 웨이포인트(곡선 정보)를 픽셀 좌표로 변환
        const getPixelWaypoints = (edge: typeof edges[number]) => 
            edge.waypoints?.map(wp => getPixel(wp)) || [];

        // 단일 Edge인 경우 처리
        if (pathEdges.length === 1) {
            const e = pathEdges[0];
            if (!e) return null;

            const n1 = nodes.find(n => n.id === e.fromId);
            const n2 = nodes.find(n => n.id === e.toId);
            if (n1 && n2) {
                points.push(getPixel(n1));
                points.push(...getPixelWaypoints(e)); // 웨이포인트 포함
                points.push(getPixel(n2));
            }
        } 
        // 다중 Edge인 경우 처리 (연결 방향 고려)
        else {
            const e0 = pathEdges[0];
            const e1 = pathEdges[1];
            if (!e0 || !e1) return null;

            // 공통 노드를 찾아 진행 방향(Direction) 추론
            const commonId = (e0.toId === e1.fromId || e0.toId === e1.toId) ? e0.toId 
                           : (e0.fromId === e1.fromId || e0.fromId === e1.toId) ? e0.fromId : null;

            let currentId = "";

            // --- 첫 번째 Edge 처리 ---
            if (commonId) {
                // 시작 노드 결정
                const startNodeId = (e0.fromId === commonId) ? e0.toId : e0.fromId;
                const startNode = nodes.find(n => n.id === startNodeId);
                const commonNode = nodes.find(n => n.id === commonId);

                if (startNode && commonNode) {
                    points.push(getPixel(startNode));
                    
                    // 웨이포인트 추가 (역방향 진행 시 뒤집기)
                    const wps = getPixelWaypoints(e0);
                    if (e0.toId === startNodeId) { // To -> From (역방향)
                         points.push(...wps.reverse());
                    } else { // From -> To (정방향)
                         points.push(...wps);
                    }
                    
                    points.push(getPixel(commonNode));
                    currentId = commonId;
                }
            } else {
                // 연결 끊김 (예외 케이스)
                const n1 = nodes.find(n => n.id === e0.fromId);
                const n2 = nodes.find(n => n.id === e0.toId);
                if(n1 && n2) {
                    points.push(getPixel(n1));
                    points.push(...getPixelWaypoints(e0));
                    points.push(getPixel(n2));
                    currentId = e0.toId; 
                }
            }

            // --- 나머지 Edge 처리 ---
            for (let i = 1; i < pathEdges.length; i++) {
                const edge = pathEdges[i];
                if (!edge) continue;

                // 다음 노드 결정 (currentId가 아닌 쪽)
                const nextId = (edge.fromId === currentId) ? edge.toId : edge.fromId;
                const nextNode = nodes.find(n => n.id === nextId);
                
                if (nextNode) {
                    // 웨이포인트 추가
                    const wps = getPixelWaypoints(edge);
                    if (edge.toId === currentId) { // Current(From) -> Next(To) : 정방향
                         points.push(...wps);
                    } else { // Current(To) -> Next(From) : 역방향
                         points.push(...wps.reverse());
                    }

                    points.push(getPixel(nextNode));
                    currentId = nextId;
                }
            }
        }

        // [Straight Line Requirement]
        // User asked for "일자로 그려" (Straight) => 노드간 직각 연결을 위해 Radius 0 적용
        return getRoundedPath(points, 0);
    }, [edges, nodes, useGraphStore.getState().highlightedPath, meta, mapHeight]);


  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <filter id="neon-strong" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
             <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            {/* --- Layer 1: Base Roads --- */}
            <g className="roads-layer">
            {uniqueEdges.map((edge) => { 
                // [Optimization Removed] We draw base roads always, so the neon path sits "on top" or "in blend"
                // const highlightedPath = useGraphStore.getState().highlightedPath || [];
                // if (highlightedPath.includes(edge.id)) return null;

                const points = getPoints(edge);
                if (!points) return null;

                // Standard Road
                return (
                <g key={`road-${edge.id}`}>
                    {/* Layer 1: Glow (Backlight) */}
                    <path
                        d={getRoundedPath(points)}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.NEON_GLOW}
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.GLOW}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: "blur(4px)", opacity: 0.6 }}
                    />
                    
                    {/* Layer 2: Outline (Border) */}
                    <path
                        d={getRoundedPath(points)}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.OUTLINE}
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.OUTLINE}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Layer 3: Core (Asphalt) */}
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

            {/* --- Layer 2: Nodes --- */}
            {nodes.map(node => {
                const pos = getPixel(node);
                const isSelected = selectedId === node.id;
                const radius = isSelected ? MAP_CONFIG.GRAPH.NODE.RADIUS.SELECTED_CORE : MAP_CONFIG.GRAPH.NODE.RADIUS.NORMAL_CORE;
                const typeColor = MAP_CONFIG.GRAPH.COLOR.NODE_TYPE[node.type as keyof typeof MAP_CONFIG.GRAPH.COLOR.NODE_TYPE] || MAP_CONFIG.GRAPH.COLOR.NODE;

                return (
                    <g key={`node-${node.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
                        <circle 
                            r={radius} 
                            fill={isSelected ? MAP_CONFIG.GRAPH.COLOR.ACTIVE : typeColor} 
                            stroke={isSelected ? 'none' : MAP_CONFIG.GRAPH.COLOR.NODE_BORDER}
                            strokeWidth={isSelected ? 0 : MAP_CONFIG.GRAPH.NODE.STROKE_WIDTH}
                        />
                    </g>
                );
            })}

            {/* --- Layer 3: ATC Merged Neon Path (Top Most) --- */}
            {mergedPathData && (
                 <g className="atc-flow-layer">
                     {/* 3.1 Outer Glow (Neon Effect) */}
                     <path
                        d={mergedPathData}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.ATC_GLOW}
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ATC_ROUTE_GLOW} // [Fix] Use dedicated glow width
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.8}
                        style={{ filter: "url(#neon-strong)" }}
                     />
                     
                    {/* 3.2 Main Solid Line */}
                    <path
                        d={mergedPathData}
                        fill="none"
                        stroke={MAP_CONFIG.GRAPH.COLOR.ATC_HIGHLIGHT} 
                        strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ATC_ROUTE}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 2px ${MAP_CONFIG.GRAPH.COLOR.ATC_HIGHLIGHT})` }}
                    />


                 </g>
            )}
        </g>
      </svg>
    </div>
  );
}
