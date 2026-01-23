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
                    
                    return (
                        <div
                            key={node.id}
                            className={`absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 pointer-events-auto
                                ${isSelected || isDraftSource
                                    ? 'bg-accent-cyan scale-125 shadow-[0_0_10px_rgba(0,255,255,0.8)]' 
                                    : 'bg-accent-orange border border-black hover:scale-110'}
                            `}
                            style={{ left: pos.x, top: pos.y }}
                            onMouseDown={(e) => {
                                if (interactionMode === 'EDGE') {
                                    e.stopPropagation(); // Stop map panning
                                    e.preventDefault();
                                    setDraftStartNode(node.id);
                                    
                                    // Hacky initialization of mouse pos
                                    // We need to attach a temporary global mouse move to track this drag
                                    // because we are dragging OUT of the node.
                                    
                                    const rect = containerRef.current?.getBoundingClientRect();
                                    if(!rect) return;

                                    // We need to reconstruct the scale logic roughly or use native offsetX/Y if possible.
                                    // Actually, let's look at e.nativeEvent.
                                    // e.preventDefault prevents selection.
                                    
                                    const handleWindowMove = (ev: MouseEvent) => {
                                        // Viewport coordinates
                                        const vx = ev.clientX - rect.left;
                                        const vy = ev.clientY - rect.top;
                                        
                                        // We need to divide by 'scale'. But we don't have it.
                                        // Wait, 'pos' (node position) is correct in CSS pixels of the scaled container?
                                        // If MapCanvas scales the container with `transform: scale()`, 
                                        // then `getBoundingClientRect` returns the SCALED size.
                                        // So (ev.clientX - rect.left) is roughly correct relative to the scaled element?
                                        // Let's try normalizing by rect width vs internal width?
                                        
                                        // Internal Width (Map Image) -> mapImage.width
                                        // Scaled Width (Rect) -> rect.width
                                        // Scale Factor = rect.width / mapImage.width (approximated)
                                        // So, Local X = (vx / rect.width) * mapImage.width
                                        
                                        // However, getPixel() returns unscaled local pixels.
                                        // So we need:
                                        
                                        const internalWidth = mapHeight > 0 ? (rect.width / rect.height) * mapHeight : 1000; // Aspect ratio guess? No.
                                        // Actually better: We know 'meta' has resolution but not strict width here.
                                        // Let's assume MapCanvas fits image.
                                        
                                        // Let's assume 1:1 mapping if we just use percentages?
                                        // No, SVG line needs exact local coordinates.
                                        
                                        // Let's blindly try a scale factor calc:
                                        // We know `pos` (node.x, node.y) is where the node is.
                                        // Mouse is at `vx, vy`.
                                        
                                        // Simple Ratio:
                                        const scaleX = rect.width / (meta.image ? 1 : 1); // We don't have image width easily here unless passed.
                                        
                                        // OK, we are stuck on coordinate conversion because we lack 'mapImage.width'.
                                        // But we assume `MapCanvas` renders at native resolution and scales via CSS `transform`.
                                        // If so, 1 CSS pixel inside the container == 1 Native Image Pixel.
                                        // BUT `getBoundingClientRect` includes the scale transform.
                                        
                                        // So: Scale = rect.width / NativeWidth.
                                        // We assume we don't know NativeWidth.
                                        
                                        // WAIT, `getPixel` returns NativeCoords. 
                                        // Our `div` container is transformed by `scale(S)`.
                                        // So logic inside the div uses NativeCoords.
                                        // So we need to map ClientMouse -> NativeCoords.
                                        
                                        // NativeX = (ClientX - Rect.Left) / Scale
                                        // We need the Scale.
                                        
                                        // Let's cheat. We can deduce scale from the node!
                                        // Node is at px=100. If rect.left + (100 * Scale) approx equals NodeScreenX...
                                        // Too complex.
                                        
                                        // Alternative: Pass `scale` from MapCanvas store?
                                        // Or just pass `mapImage.width` in props?
                                        // We passed `mapHeight`. If we pass `mapWidth` too, we can solve this.
                                    };
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
