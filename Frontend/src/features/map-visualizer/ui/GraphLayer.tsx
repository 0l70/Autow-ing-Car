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
export function GraphLayer({ meta, mapHeight }: GraphLayerProps) {
    const { nodes, edges, selectedId } = useGraphStore();
    console.log(`[GraphLayer] Nodes: ${nodes.length}, Edges: ${edges.length}, mapHeight: ${mapHeight}`);

    if (!meta || mapHeight === 0) return null;

    const getPixel = (world: WorldCoord) => worldToPixel(world, meta, mapHeight);

    return (
        <div className="absolute inset-0 pointer-events-none z-30">
            {/* SVG Layer for Edges */}
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {edges.map(edge => {
                    const fromNode = nodes.find(n => n.id === edge.fromId);
                    const toNode = nodes.find(n => n.id === edge.toId);
                    if (!fromNode || !toNode) return null;

                    const p1 = getPixel(fromNode);
                    const p2 = getPixel(toNode);

                    // 하이라이트 여부
                    const isSelected = selectedId === edge.id;
                    const strokeColor = isSelected ? "#00FFFF" : "#FFA500";
                    const strokeWidth = isSelected ? 3 : 2;

                    return (
                        <line 
                            key={edge.id}
                            x1={p1.x} y1={p1.y} 
                            x2={p2.x} y2={p2.y} 
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            opacity={0.8}
                        />
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

                    const sizeClass = (node.type === 'RUNWAY') ? 'w-4 h-4' : 
                                      (node.type === 'GATE' || node.type === 'CHARGER') ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';

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
