import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import { Loader2 } from "lucide-react";
import { MapMetaSchema } from "@/entities/map/model/schema";
import { type MapMeta, type WorldCoord } from "@/entities/map/model/types";
import { loadPGM } from "@/entities/map/lib/pgmParser";
import { pixelToWorld } from "@/entities/map/lib/coordinate";

interface MapCanvasProps {
    mapName: string; // e.g., "airport_map1"
    onMapLoad?: (meta: MapMeta) => void;
    onMapClick?: (worldPos: WorldCoord) => void;
    className?: string;
    children?: React.ReactNode;
}

export function MapCanvas({ mapName, onMapLoad, onMapClick, className, children }: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Viewport State (Pan/Zoom)
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // 1. Fetch Map Metadata (YAML)
    const { data: meta, isLoading: isMetaLoading } = useQuery({
        queryKey: ['map', mapName, 'meta'],
        queryFn: async () => {
             const res = await fetch(`/maps/${mapName}.yaml`);
             const text = await res.text();
             const parsed = yaml.load(text);
             return MapMetaSchema.parse(parsed); // Zod Validation
        }
    });

    // 2. Fetch & Prepare Map Image (PGM -> Bitmap)
    const { data: mapImage, isLoading: isImageLoading } = useQuery({
        queryKey: ['map', mapName, 'image'],
        queryFn: async () => {
            if (!meta) return null;
            // Assuming image path in YAML is relative to the YAML file
            // But frontend public assets are flat or relative to root.
            // Let's assume the user put the pgm next to yaml in /maps/
            return loadPGM(`/maps/${meta.image}`);
        },
        enabled: !!meta
    });

    // 3. Render Map to Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to match image resolution exactly
        canvas.width = mapImage.width;
        canvas.height = mapImage.height;

        console.log(`[MapCanvas] Drawing Map: ${mapImage.width}x${mapImage.height}`);

        // Draw Debug Background (If map is transparent/missing, this will show)
        ctx.fillStyle = '#330000'; // Dark Red
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Image
        ctx.drawImage(mapImage, 0, 0);

        // Debug: Check center pixel
        const centerData = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
        console.log(`[MapCanvas] Center Pixel: RGBA(${centerData[0]}, ${centerData[1]}, ${centerData[2]}, ${centerData[3]})`);

        if (meta && onMapLoad) onMapLoad(meta);

    }, [mapImage, meta, onMapLoad]);

    // Handlers: Zoom (Wheel)
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault(); // Stop page scroll
        const zoomFactor = 1.1;
        const delta = -Math.sign(e.deltaY);
        const newScale = delta > 0 ? scale * zoomFactor : scale / zoomFactor;
        
        // Clamp Zoom
        const clampedScale = Math.min(Math.max(newScale, 0.1), 10);
        setScale(clampedScale);
    };

    // Handlers: Pan (Drag)
    const handleMouseDown = (e: MouseEvent) => {
        // Only drag if middle mouse or space held? Or simplistic logic:
        // Let's use left click for Pan if no tool selected (default)
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Handler: Click (Coordinate Picking)
    const handleClick = (e: MouseEvent) => {
        if (isDragging) return; // Did a drag, not a click
        if (!meta || !canvasRef.current || !onMapClick) return;

        // 1. Get click position relative to Container (Viewport)
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;

        // 2. Transform Viewport -> Canvas Pixel
        // Canvas is transformed by: translate(offset.x, offset.y) scale(scale)
        // inverse: (viewport - offset) / scale
        const canvasX = (viewportX - offset.x) / scale;
        const canvasY = (viewportY - offset.y) / scale;

        // check bounds
        if (canvasX < 0 || canvasX > (mapImage?.width || 0) || canvasY < 0 || canvasY > (mapImage?.height || 0)) {
            return;
        }

        // 3. Pixel -> World
        const worldPos = pixelToWorld({ x: canvasX, y: canvasY }, meta, mapImage!.height);
        onMapClick(worldPos);
        
        console.log(`[MapCanvas] Click: Pixel(${canvasX.toFixed(0)}, ${canvasY.toFixed(0)}) -> World(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
    };

    if (isMetaLoading || isImageLoading) {
        return <div className="flex items-center justify-center h-full text-accent-cyan animate-pulse gap-2">
            <Loader2 className="animate-spin" /> Loading Map System...
        </div>;
    }

    return (
        <div 
            ref={containerRef}
            className={`relative overflow-hidden bg-[#050505] cursor-crosshair select-none ${className}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
        >
            {/* The Scalable Map Layer */}
            <div 
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <canvas ref={canvasRef} className="image-pixelated block" />
                
                {/* Overlay Layer for Children (Routes, Nodes, Aircraft) */}
                <div className="absolute inset-0 pointer-events-none">
                    {children}
                </div>
            </div>

            {/* HUD / Debug Info */}
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 pointer-events-none">
                 <div className="bg-black/80 text-[10px] font-mono text-accent-cyan px-2 py-1 rounded border border-accent-cyan/20">
                    SCALE: {scale.toFixed(2)}x | OFFSET: {offset.x | 0}, {offset.y | 0}
                 </div>
                 {/* DEBUG INFO: Helps user verify map data if screen is black */}
                 <div className="bg-red-900/80 text-[10px] font-mono text-white px-2 py-1 rounded border border-red-500/50">
                    DEBUG: {mapImage ? `${mapImage.width}x${mapImage.height}` : 'Loading...'} 
                    {meta ? ` | RES: ${meta.resolution}` : ''}
                 </div>
            </div>
        </div>
    );
}
