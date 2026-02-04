import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, WorldCoord } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";

interface GraphLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
}

/**
 * 컴포넌트: 그래프 레이어 (뷰어 전용)
 * 노드와 엣지를 단순 표시합니다. (편집 기능 없음)
 */
/**
 * 지도 위의 노드와 간선(그래프)을 시각화하는 레이어 컴포넌트
 * SVG를 사용하여 간선을 그리고, HTML 엘리먼트로 노드를 표시합니다.
 */
export function GraphLayer({ meta, mapHeight }: GraphLayerProps) {
    const { nodes, edges, selectedId } = useGraphStore();
    // console.log(`[GraphLayer] Nodes: ${nodes.length}, Edges: ${edges.length}, mapHeight: ${mapHeight}`);

    if (!meta || mapHeight === 0) return null;

    // Local non-null meta for TS and performance
    const activeMeta = meta;
    const getPixel = (world: WorldCoord) => worldToPixel(world, activeMeta, mapHeight);

    // [Catmull-Rom Spline] 모든 점을 정확히 통과하는 매끄러운 곡선 생성
    const getCatmullRomPath = (points: { x: number, y: number }[]) => {
        if (!points || points.length < 2) return "";
        
        const p0 = points[0];
        const last = points[points.length - 1];
        if (!p0 || !last) return "";

        // 점이 2개뿐이면 단순 직선 연결
        if (points.length === 2) {
            return `M ${p0.x} ${p0.y} L ${last.x} ${last.y}`;
        }

        // Catmull-Rom to Bezier 변환 (tension = 0.5)
        const tension = 0.5;
        let d = `M ${p0.x} ${p0.y}`;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0i = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[Math.min(points.length - 1, i + 1)];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            if (!p0i || !p1 || !p2 || !p3) continue;
            
            // Control points for cubic bezier
            const cp1x = p1.x + (p2.x - p0i.x) * tension / 3;
            const cp1y = p1.y + (p2.y - p0i.y) * tension / 3;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
            
            d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
        }
        
        return d;
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-30">
            {/* 간선(Edge) 시각화를 위한 SVG 레이어 */}
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {/* 도로 그라데이션 정의 */}
                <defs>
                    <linearGradient id="roadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#5a5a5a" />
                        <stop offset="50%" stopColor="#7a7a7a" />
                        <stop offset="100%" stopColor="#5a5a5a" />
                    </linearGradient>
                    <linearGradient id="roadGradientSelected" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#00aaaa" />
                        <stop offset="50%" stopColor="#00ffff" />
                        <stop offset="100%" stopColor="#00aaaa" />
                    </linearGradient>
                </defs>

                {edges.map(edge => {
                    const fromNode = nodes.find(n => n.id === edge.fromId);
                    const toNode = nodes.find(n => n.id === edge.toId);
                    if (!fromNode || !toNode) return null;

                    const p1 = getPixel(fromNode);
                    const p2 = getPixel(toNode);

                    // 하이라이트 여부
                    const isSelected = selectedId === edge.id;

                    // Construct Full Point List: FromNode -> Waypoints -> ToNode
                    const waypoints = edge.waypoints?.map(wp => getPixel(wp)) || [];
                    const allPoints = [p1, ...waypoints, p2];

                    return (
                        <g key={edge.id}>
                            {/* 도로 배경 (넓은 폭) */}
                            <path 
                                d={getCatmullRomPath(allPoints)}
                                fill="none"
                                stroke={isSelected ? "url(#roadGradientSelected)" : "url(#roadGradient)"}
                                strokeWidth={isSelected ? 14 : 10}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.9}
                                className="transition-all duration-300"
                            />
                            {/* 도로 중앙선 (노란색 점선) */}
                            <path 
                                d={getCatmullRomPath(allPoints)}
                                fill="none"
                                stroke={isSelected ? "#ffffff" : "#FFD700"}
                                strokeWidth={1}
                                strokeDasharray="4 6"
                                strokeLinecap="round"
                                opacity={0.7}
                            />
                        </g>
                    );
                })}
            </svg>


            {/* HTML Layer for Nodes */}
            <div className="absolute inset-0 w-full h-full">
                {nodes.map(node => {
                    const pos = getPixel(node);
                    const isSelected = selectedId === node.id;
                    
                    // 타입별 스타일
                    const getNodeColor = (type: string) => {
                        switch(type) {
                            case 'RUNWAY': return 'bg-blue-500 border-blue-300';
                            case 'GATE': return 'bg-green-500 border-green-300';
                            case 'CHARGER': return 'bg-yellow-500 border-yellow-300';
                            case 'INTERSECTION': return 'bg-gray-400 border-gray-300';
                            default: return 'bg-accent-orange border-black';
                        }
                    };

                    const sizeClass = (node.type === 'RUNWAY') ? 'w-6 h-6' : 
                                      (node.type === 'GATE' || node.type === 'CHARGER') ? 'w-5 h-5' : 'w-4 h-4';

                    const activeClass = isSelected
                        ? 'bg-accent-cyan scale-125 shadow-[0_0_10px_cyan] z-40 ring-1 ring-white' 
                        : `${getNodeColor(node.type)} z-30`;

                    return (
                        <div
                            key={node.id}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-200 ${sizeClass} ${activeClass}`}
                            style={{ left: pos.x, top: pos.y }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
