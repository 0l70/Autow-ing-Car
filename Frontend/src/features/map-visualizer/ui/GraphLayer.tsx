import { useMemo, useCallback } from 'react';
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, WorldCoord } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

interface GraphLayerProps {
  meta: MapMeta | null;
  mapHeight: number;
  overridePath?: string[] | undefined; 
  activePathColor?: string; 
  activeNodeColor?: string; 
  activeNodeBorderColor?: string;
}

export function GraphLayer({ 
    meta, 
    mapHeight, 
    overridePath, 
    activePathColor,
    activeNodeColor,
    activeNodeBorderColor
}: GraphLayerProps) {
  const { nodes, edges, selectedId } = useGraphStore();
  const { offset, scale } = useMapCamera();

  // 1. Hook Constants
  const pathColor = activePathColor || MAP_CONFIG.GRAPH.COLOR.ATC_GLOW;
  const nodeFill = activeNodeColor || MAP_CONFIG.GRAPH.COLOR.ACTIVE;
  const nodeStroke = activeNodeBorderColor || MAP_CONFIG.GRAPH.COLOR.ACTIVE_BORDER;

  // 2. Pixel Transformation Hook
  const getPixel = useCallback((world: WorldCoord) => {
    if (!meta || mapHeight === 0) return { x: 0, y: 0 };
    return worldToPixel(world, meta, mapHeight);
  }, [meta, mapHeight]);

  // 3. Deduplication Logic
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

  // 4. Path Geometry Logic
  const getRoundedPath = useCallback((rawPoints: { x: number; y: number }[], radius: number = MAP_CONFIG.GRAPH.EDGE.CORNER_RADIUS) => {
    if (!rawPoints || rawPoints.length < 2) return "";
    const points = rawPoints.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
    if (points.length < 2) return "";
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1]; const p1 = points[i]; const p2 = points[i + 1];
        if (!p0 || !p1 || !p2) continue;
        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y }; const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y); const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (len1 === 0 || len2 === 0) { d += ` L ${p1.x} ${p1.y}`; continue; }
        const r = Math.min(radius, len1 * 0.45, len2 * 0.45);
        const o1 = { x: p1.x + (v1.x / len1) * r, y: p1.y + (v1.y / len1) * r };
        const o2 = { x: p1.x + (v2.x / len2) * r, y: p1.y + (v2.y / len2) * r };
        d += ` L ${o1.x} ${o1.y} Q ${p1.x} ${p1.y} ${o2.x} ${o2.y}`;
    }
    const last = points[points.length - 1];
    if (last) d += ` L ${last.x} ${last.y}`;
    return d;
  }, []);

  // 5. Path Merging Logic
  const mergedPathData = useMemo(() => {
    const highlightedPath = overridePath || [];
    if (highlightedPath.length === 0 || !meta || mapHeight === 0) return null;

    const pathEdges = highlightedPath.map(id => edges.find(e => e.id === id)).filter((e): e is typeof edges[number] => !!e);
    if (pathEdges.length === 0) return null;
    const points: WorldCoord[] = [];
    const getPixelWaypoints = (edge: typeof edges[number]) => edge.waypoints?.map(wp => getPixel(wp)) || [];

    if (pathEdges.length === 1) {
        const e = pathEdges[0]; if (!e) return null;
        const n1 = nodes.find(n => n.id === e.fromId); const n2 = nodes.find(n => n.id === e.toId);
        if (n1 && n2) points.push(getPixel(n1), ...getPixelWaypoints(e), getPixel(n2));
    } else {
        const e0 = pathEdges[0]; const e1 = pathEdges[1]; if (!e0 || !e1) return null;
        const commonId = (e0.toId === e1.fromId || e0.toId === e1.toId) ? e0.toId : (e0.fromId === e1.fromId || e0.fromId === e1.toId) ? e0.fromId : null;
        let cId = "";
        if (commonId) {
            const sId = (e0.fromId === commonId) ? e0.toId : e0.fromId;
            const sn = nodes.find(n => n.id === sId); const cn = nodes.find(n => n.id === commonId);
            if (sn && cn) {
                points.push(getPixel(sn)); const wps = getPixelWaypoints(e0);
                if (e0.toId === sId) points.push(...wps.reverse()); else points.push(...wps);
                points.push(getPixel(cn)); cId = commonId;
            }
        } else {
            const n1 = nodes.find(n => n.id === e0.fromId); const n2 = nodes.find(n => n.id === e0.toId);
            if(n1 && n2) { points.push(getPixel(n1), ...getPixelWaypoints(e0), getPixel(n2)); cId = e0.toId; }
        }
        for (let i = 1; i < pathEdges.length; i++) {
            const edge = pathEdges[i]; if (!edge) continue;
            const nextId = (edge.fromId === cId) ? edge.toId : edge.fromId;
            const nextNode = nodes.find(n => n.id === nextId);
            if (nextNode) {
                const wps = getPixelWaypoints(edge);
                if (edge.fromId === cId) points.push(...wps); else points.push(...wps.reverse());
                points.push(getPixel(nextNode)); cId = nextId;
            }
        }
    }
    return getRoundedPath(points, 0); 
  }, [edges, nodes, overridePath, meta, mapHeight, getPixel, getRoundedPath]);

  // 6. Active Nodes Logic
  const pathNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) ids.add(selectedId);
    if (overridePath) {
        overridePath.forEach(id => {
            const e = edges.find(ed => ed.id === id);
            if (e) { ids.add(e.fromId); ids.add(e.toId); }
        });
    }
    return ids;
  }, [edges, selectedId, overridePath]);

  if (!meta || mapHeight === 0) return null;

  const getPoints = (edge: typeof edges[number]) => {
    const fNode = nodes.find(n => n.id === edge.fromId); const tNode = nodes.find(n => n.id === edge.toId);
    if (!fNode || !tNode) return null;
    return [getPixel(fNode), ...(edge.waypoints?.map(wp => getPixel(wp)) || []), getPixel(tNode)];
  };

  const transformStyle = `translate(${offset.x}, ${offset.y}) scale(${scale})`;

  return (
    <>
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: MAP_CONFIG.Z_INDEX.GRAPH_LAYER }}>
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                <g transform={transformStyle}>
                    {uniqueEdges.map((edge) => { 
                        const pts = getPoints(edge); if (!pts) return null;
                        const d = getRoundedPath(pts);
                        return (
                        <g key={`road-${edge.id}`}>
                             <path d={d} fill="none" stroke={MAP_CONFIG.GRAPH.COLOR.NEON_GLOW} strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.GLOW} style={{ filter: "blur(4px)", opacity: 0.6 }} />
                             <path d={d} fill="none" stroke={MAP_CONFIG.GRAPH.COLOR.OUTLINE} strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.OUTLINE} />
                             <path d={d} fill="none" stroke={MAP_CONFIG.GRAPH.COLOR.DEFAULT} strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.CORE} />
                        </g>
                        );
                    })}
                </g>
            </svg>
        </div>
        {mergedPathData && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: MAP_CONFIG.Z_INDEX.GRAPH_LAYER }}>
                <svg className="absolute inset-0 w-full h-full overflow-visible">
                    <g transform={transformStyle}>
                        <path d={mergedPathData} fill="none" stroke={pathColor} strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ACTIVE_GLOW} style={{ filter: "blur(4px)", opacity: 0.6 }} />
                        <path d={mergedPathData} fill="none" stroke={pathColor} strokeWidth={MAP_CONFIG.GRAPH.EDGE.WIDTH.ACTIVE_GLOW} strokeDasharray="1 1" pathLength={1} className="animate-fill-loop" style={{ filter: "blur(2px)", opacity: 1.0 }} />
                    </g>
                </svg>
            </div>
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: MAP_CONFIG.Z_INDEX.GRAPH_LAYER }}>
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                <g transform={transformStyle}>
                    {nodes.map(node => {
                        if (pathNodeIds.has(node.id)) return null;
                        const pos = getPixel(node);
                        const tColor = MAP_CONFIG.GRAPH.COLOR.NODE_TYPE[node.type as keyof typeof MAP_CONFIG.GRAPH.COLOR.NODE_TYPE] || MAP_CONFIG.GRAPH.COLOR.NODE;
                        return (
                            <g key={`node-${node.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
                                <circle r={MAP_CONFIG.GRAPH.NODE.RADIUS.NORMAL_CORE} fill={tColor} stroke={MAP_CONFIG.GRAPH.COLOR.NODE_BORDER} strokeWidth={MAP_CONFIG.GRAPH.NODE.STROKE_WIDTH} />
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
        {pathNodeIds.size > 0 && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: MAP_CONFIG.Z_INDEX.GRAPH_LAYER }}>
                <svg className="absolute inset-0 w-full h-full overflow-visible">
                    <g transform={transformStyle}>
                        {nodes.map(node => {
                            if (!pathNodeIds.has(node.id)) return null;
                            const pos = getPixel(node);
                            return (
                                <g key={`active-node-${node.id}`} transform={`translate(${pos.x}, ${pos.y})`}>
                                    <circle r={MAP_CONFIG.GRAPH.NODE.RADIUS.SELECTED_CORE} fill={nodeFill} stroke={nodeStroke} strokeWidth={MAP_CONFIG.GRAPH.NODE.STROKE_WIDTH} />
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>
        )}
    </>
  );
}
