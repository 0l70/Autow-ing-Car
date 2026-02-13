import { useState, useRef, useEffect } from "react";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, WorldCoord } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { GraphLayer } from "@/features/map-visualizer/ui/GraphLayer";

interface GraphEditorLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
}

/**
 * 컴포넌트: 그래프 편집 레이어
 * GraphLayer(보기)를 깔고, 그 위에 편집 인터랙션(드래그, 클릭 등)을 덧씌웁니다.
 */
export function GraphEditorLayer({ meta, mapHeight }: GraphEditorLayerProps) {
    const { nodes, interactionMode, selectItem, addEdge } = useGraphStore();
    
    // Draft Edge State (가상의 선 긋기)
    const [draftStartNode, setDraftStartNode] = useState<string | null>(null);
    const [draftMousePos, setDraftMousePos] = useState<{x: number, y: number} | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Global Mouse Up
    useEffect(() => {
        const handleGlobalMouseUp = () => {
             if (draftStartNode) {
                 setDraftStartNode(null);
                 setDraftMousePos(null);
             }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [draftStartNode]);

    if (!meta || mapHeight === 0) return null;

    const getPixel = (world: WorldCoord) => worldToPixel(world, meta, mapHeight);

    return (
        <div ref={containerRef} className="absolute inset-0 z-10">
            {/* 1. 기본 뷰어 (읽기 전용 표시) */}
            <GraphLayer meta={meta} mapHeight={mapHeight} />

            {/* 2. 인터랙션 오버레이 (편집 전용) */}
            <div className="absolute inset-0 w-full h-full pointer-events-none">
                
                {/* Draft Line (그리는 중인 선) */}
                <svg className="absolute inset-0 w-full h-full overflow-visible">
                    {draftStartNode && draftMousePos && (() => {
                         const startNode = nodes.find(n => n.id === draftStartNode);
                         if(!startNode) return null;
                         const p1 = getPixel(startNode);
                         return (
                             <line 
                                x1={p1.x} y1={p1.y}
                                x2={draftMousePos.x} y2={draftMousePos.y}
                                stroke="#FFA500"
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                             />
                         );
                    })()}
                </svg>

                {/* Node Interaction Hit Areas (투명하지만 클릭/드래그 가능) */}
                {nodes.map(node => {
                    const pos = getPixel(node);
                    return (
                        <div
                            key={`hit-${node.id}`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full cursor-pointer pointer-events-auto"
                            style={{ left: pos.x, top: pos.y }}
                            onMouseDown={(e) => {
                                if (interactionMode === 'EDGE') {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setDraftStartNode(node.id);
                                }
                            }}
                            onMouseUp={(e) => {
                                if (interactionMode === 'EDGE' && draftStartNode) {
                                    e.stopPropagation();
                                    if (draftStartNode !== node.id) {
                                        addEdge(draftStartNode, node.id);
                                    }
                                    setDraftStartNode(null);
                                    setDraftMousePos(null);
                                }
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if(interactionMode === 'SELECT') selectItem(node.id);
                            }}
                        />
                    );
                })}
                
                {/* Dragging Handler (빈 공간 드래그 감지) */}
                {draftStartNode && (
                    <div 
                        className="absolute inset-0 z-50 cursor-crosshair pointer-events-auto"
                        onMouseMove={(e) => {
                            setDraftMousePos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
                        }}
                        onMouseUp={() => {
                            setDraftStartNode(null);
                            setDraftMousePos(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
