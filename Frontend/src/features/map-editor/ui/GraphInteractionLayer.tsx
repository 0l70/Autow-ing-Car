import { useState, useRef, useEffect } from "react";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, WorldCoord } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";

interface GraphInteractionLayerProps {
    meta: MapMeta | null;
    mapHeight: number;
}

export function GraphInteractionLayer({ meta, mapHeight }: GraphInteractionLayerProps) {
    const { nodes, edges, interactionMode, selectItem, selectedId, addEdge } = useGraphStore();
    
    // Draft Edge State
    const [draftStartNode, setDraftStartNode] = useState<string | null>(null);
    const [draftMousePos, setDraftMousePos] = useState<{x: number, y: number} | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Global Mouse Up to cancel drag if missed
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

    // Removed unused handleMouseMove logic
    
    return (
        <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none">
            {/* SVG Layer for Edges (Lines) */}
            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                {edges.map(edge => {
                    const fromNode = nodes.find(n => n.id === edge.fromId);
                    const toNode = nodes.find(n => n.id === edge.toId);
                    if (!fromNode || !toNode) return null;

                    const p1 = getPixel(fromNode);
                    const p2 = getPixel(toNode);

                    return (
                        <g key={edge.id}>
                            <line 
                                x1={p1.x} y1={p1.y} 
                                x2={p2.x} y2={p2.y} 
                                // Changed default color from transparent white to Orange for visibility on white maps
                                stroke={selectedId === edge.id ? "#00FFFF" : "#FFA500"}
                                strokeWidth={selectedId === edge.id ? 3 : 2}
                                className="pointer-events-auto cursor-pointer hover:stroke-accent-cyan transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(interactionMode === 'SELECT') selectItem(edge.id);
                                }}
                            />
                        </g>
                    );
                })}
                
                {/* DRAFT EDGE (The Dotted Line) */}
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

            {/* HTML Layer for Nodes (Divs) */}
            <div className="absolute inset-0 w-full h-full">
                {nodes.map(node => {
                    const pos = getPixel(node);
                    const isSelected = selectedId === node.id;
                    const isDraftSource = draftStartNode === node.id;
                    
                    // Type-based styling
                    const getNodeColor = (type: string) => {
                        switch(type) {
                            case 'RUNWAY': return 'bg-blue-500 border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.6)]';
                            case 'GATE': return 'bg-green-500 border-green-300 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
                            case 'CHARGER': return 'bg-yellow-500 border-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.6)]';
                            case 'INTERSECTION': return 'bg-gray-400 border-gray-300';
                            default: return 'bg-accent-orange border-black';
                        }
                    };

                    const getNodeSize = (type: string) => {
                         if (type === 'RUNWAY') return 'w-4 h-4';
                         if (type === 'GATE' || type === 'CHARGER') return 'w-3.5 h-3.5';
                         return 'w-2.5 h-2.5';
                    };

                    const activeClass = isSelected || isDraftSource
                        ? 'bg-accent-cyan scale-125 shadow-[0_0_15px_rgba(0,255,255,0.9)] z-20 ring-2 ring-white' 
                        : `${getNodeColor(node.type)} hover:scale-125 hover:z-10`;

                    return (
                        <div
                            key={node.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto cursor-pointer group"
                            style={{ left: pos.x, top: pos.y }}
                            onMouseDown={(e) => {
                                if (interactionMode === 'EDGE') {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setDraftStartNode(node.id);
                                    
                                    // Hacky initialization of mouse pos
                                    const rect = containerRef.current?.getBoundingClientRect();
                                    if(!rect) return;
                                    
                                     // ... existing logic ...
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
                        >
                            {/* Node Circle */}
                            <div className={`rounded-full transition-all duration-200 border ${getNodeSize(node.type)} ${activeClass}`} />
                            
                            {/* Label (Visible on Hover or if significant type) */}
                            {node.label && (
                                <div className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none whitespace-nowrap backdrop-blur-md border border-white/10 transition-opacity
                                    ${isSelected ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30 opacity-100' : 'bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100'}
                                    ${(node.type === 'RUNWAY' || node.type === 'GATE') ? 'opacity-80' : ''} 
                                `}>
                                    {node.label}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {/* 
               We need a "Drag Handler" overlay to capture mouse moves across the map 
               (not just on nodes) IF we are dragging.
            */}
             {draftStartNode && (
                <div 
                    className="absolute inset-0 z-50 cursor-crosshair"
                    onMouseMove={(e) => {
                        // Here we are inside the transformed container.
                        // nativeEvent.offsetX should be in local space!
                        // Browser handles the coordinate space of the target element.
                        // Since this overlay fills the container (which is 1:1 with map image pixels before scale),
                        // offsetX/Y should be exactly what we want!
                        
                        setDraftMousePos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
                    }}
                    onMouseUp={() => {
                        // Dropped on empty space
                        setDraftStartNode(null);
                        setDraftMousePos(null);
                    }}
                />
            )}

        </div>
    );
}
