import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import { Loader2 } from "lucide-react";
import { MapMetaSchema } from "@/entities/map/model/schema";
import { type MapMeta, type WorldCoord } from "@/entities/map/model/types";
import { loadPGM } from "@/entities/map/lib/pgmParser";
import { pixelToWorld } from "@/entities/map/lib/coordinate";

interface MapInfo {
    meta: MapMeta;
    width: number;
    height: number;
}

interface MapBoardProps {
    // Legacy support alias if needed, or just standard naming
}

interface MapCanvasProps {
    mapName: string; // e.g., "airport_map1"
    onMapLoad?: (info: MapInfo) => void;
    onMapClick?: (worldPos: WorldCoord) => void;
    className?: string;
    children?: React.ReactNode;
    visualStyle?: 'default' | 'abstract';
    gridMetadata?: { width: number; height: number; resolution: number; }; 
}

export function MapCanvas({ mapName, onMapLoad, onMapClick, className, children, visualStyle = 'default', gridMetadata }: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Viewport State (Pan/Zoom)
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // 1. Fetch Map Metadata (Only in default mode)
    const { data: meta, isLoading: isMetaLoading } = useQuery({
        queryKey: ['map', mapName, 'meta'],
        queryFn: async () => {
             if (visualStyle === 'abstract') return null;
             const res = await fetch(`/maps/${mapName}.yaml`);
             const text = await res.text();
             const parsed = yaml.load(text);
             return MapMetaSchema.parse(parsed); 
        },
        enabled: visualStyle === 'default'
    });

    // 2. Fetch & Prepare Map Image (Only in default mode)
    const { data: mapImage, isLoading: isImageLoading } = useQuery({
        queryKey: ['map', mapName, 'image'],
        queryFn: async () => {
            if (visualStyle === 'abstract') return null;
            if (!meta) return null;
            return loadPGM(`/maps/${meta.image}`);
        },
        enabled: visualStyle === 'default' && !!meta
    });

    // 3. Render Map OR Abstract Grid
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;

        if (visualStyle === 'default') {
             if (!mapImage) return;
             width = mapImage.width;
             height = mapImage.height;
        } else {
             // Abstract Mode uses provided metadata or defaults
             width = gridMetadata?.width || 2000;
             height = gridMetadata?.height || 1500;
        }

        // Resize canvas
        canvas.width = width;
        canvas.height = height;

        // --- RENDERING ---
        if (visualStyle === 'default' && mapImage) {
            // Draw Debug Background
            ctx.fillStyle = '#330000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw Image
            ctx.drawImage(mapImage, 0, 0);
        } else if (visualStyle === 'abstract') {
            // == NEON GRID RENDERING ==
            
            // 1. Background (Dark Void)
            ctx.fillStyle = '#020408'; // Deep Dark Blue-Black
            ctx.fillRect(0, 0, width, height);

            // 2. Grid Lines
            const resolution = gridMetadata?.resolution || 0.05;
            const meterPerPixel = 1 / resolution; // Pixels per meter
            const gridSizeMajor = 10 / resolution; // 10 meters
            const gridSizeMinor = 1 / resolution;  // 1 meter

            // Draw Minor Grid (Faint)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            
            for (let x = 0; x <= width; x += gridSizeMinor) {
                ctx.moveTo(x, 0); ctx.lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gridSizeMinor) {
                ctx.moveTo(0, y); ctx.lineTo(width, y);
            }
            ctx.stroke();

            // Draw Major Grid (Brighter)
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            
            for (let x = 0; x <= width; x += gridSizeMajor) {
                ctx.moveTo(x, 0); ctx.lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gridSizeMajor) {
                ctx.moveTo(0, y); ctx.lineTo(width, y);
            }
            ctx.shadowColor = '#00FFFF';
            ctx.shadowBlur = 4;
            ctx.stroke();
            
            // Reset Shadow
            ctx.shadowBlur = 0;
        }
        
        console.log(`[MapCanvas] Drawn Mode: ${visualStyle} (${width}x${height})`);

    }, [mapImage, visualStyle, gridMetadata]);

    // 4. Auto-Center Logic (Runs when dimensions change or Resize occurs)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleAutoFit = () => {
            const width = visualStyle === 'default' ? mapImage?.width : (gridMetadata?.width || 2000);
            const height = visualStyle === 'default' ? mapImage?.height : (gridMetadata?.height || 1500);

            if (!width || !height) return;

            const containerW = container.clientWidth;
            const containerH = container.clientHeight;

            if (containerW === 0 || containerH === 0) {
                 // Container not ready yet
                 return;
            }

            const scaleX = (containerW - 50 * 2) / width;
            const scaleY = (containerH - 50 * 2) / height;
            
            // Use 60% of the calculated fit to leave significant breathing room (User requested ~0.31 scale)
            const fitScale = Math.min(scaleX, scaleY, 10) * 0.6; 
            
            const offsetX = (containerW - width * fitScale) / 2;
            const offsetY = (containerH - height * fitScale) / 2;

            setScale(fitScale);
            setOffset({ x: offsetX, y: offsetY });
            console.log(`[MapCanvas] Auto-Centered: Scale ${fitScale.toFixed(3)}, Container: ${containerW}x${containerH}`);
        };

        // Polling to wait for container to have valid dimensions (Fixes 0 size issue on load)
        const timer = setInterval(() => {
            if (!container) {
                return;
            }
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;

            if (containerW > 0 && containerH > 0) {
                 const width = visualStyle === 'default' ? mapImage?.width : (gridMetadata?.width || 2000);
                 const height = visualStyle === 'default' ? mapImage?.height : (gridMetadata?.height || 1500);
                 
                 if (!width || !height) return;

                 const scaleX = (containerW - 50 * 2) / width;
                 const scaleY = (containerH - 50 * 2) / height;

                 // User preferred ~0.31. Assuming standard 1080p layout (~1000px wide space):
                 // 1000 / 2000 = 0.5. So 0.5 * 0.65 = 0.325.
                 // We'll use 0.8 to be safe but allow it to be larger than 0.15.
                 // If previous result was 0.15, then scaleX/Y was ~0.25. (container ~500px?).
                 // Let's try 0.9 factor to fill more space, relying on manual zoom for preference.
                 const fitScale = Math.min(scaleX, scaleY, 1) * 0.9; 
                 
                 const offsetX = (containerW - width * fitScale) / 2;
                 const offsetY = (containerH - height * fitScale) / 2;
    
                 setScale(fitScale);
                 setOffset({ x: offsetX, y: offsetY });
                 console.log(`[MapCanvas] Initial Auto-Fit: Scale ${fitScale.toFixed(3)}, Container: ${containerW}x${containerH}`);
                 
                 // Clear interval once successfully fitted
                 clearInterval(timer);
            }
        }, 100); // Check every 100ms

        return () => {
             clearInterval(timer);
        };

    }, [mapImage, visualStyle, gridMetadata]);

    // 5. Notify Parent
    useEffect(() => {
         const width = visualStyle === 'default' ? mapImage?.width : (gridMetadata?.width || 2000);
         const height = visualStyle === 'default' ? mapImage?.height : (gridMetadata?.height || 1500);

         if (width && height && onMapLoad) {
             // Mock Meta for Abstract
             const metaToPass = meta || {
                 image: 'abstract',
                 resolution: gridMetadata?.resolution || 0.05,
                 origin: [0,0,0],
                 negate: false,
                 occupied_thresh: 0.5,
                 free_thresh: 0.5,
                 mode: 'raw' as const
             };

            onMapLoad({
                meta: metaToPass,
                width,
                height
            });
        }
    }, [mapImage, meta, onMapLoad, visualStyle, gridMetadata]);

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

    // Fix: Only block rendering if we are in 'default' mode and actually loading
    const isLoading = visualStyle === 'default' && (isMetaLoading || isImageLoading);

    if (isLoading) {
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
                <div className="absolute inset-0">
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
