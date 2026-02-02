import { useEffect, useRef, useState, useLayoutEffect, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import yaml from "js-yaml";
import { Loader2 } from "lucide-react";
import { type MapMeta, type WorldCoord } from "@/entities/map/model/types";
import { MapMetaSchema } from "@/entities/map/model/schema";
import { loadPGM } from "@/entities/map/lib/pgmParser";
import { pixelToWorld } from "@/entities/map/lib/coordinate";

// --- Types ---
interface MapInfo {
    meta: MapMeta;
    width: number;
    height: number;
}

interface MapCanvasProps {
    mapName: string; 
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
    
    // Viewport State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 }); // for drag delta

    // --- 1. Data Fetching ---
    
    // Fetch Meta
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

    // Fetch Image
    const { data: mapImage, isLoading: isImageLoading } = useQuery({
        queryKey: ['map', mapName, 'image', visualStyle],
        queryFn: async () => {
            if (visualStyle === 'abstract') return null;
            if (!meta) return null;
            return loadPGM(`/maps/${meta.image}`);
        },
        enabled: visualStyle === 'default' && !!meta
    });

    // --- 2. Helper Logic (Dimensions) ---
    const getMapDimensions = () => {
        if (visualStyle === 'abstract') {
            return { width: gridMetadata?.width || 2000, height: gridMetadata?.height || 1500 };
        }
        return { width: mapImage?.width || 0, height: mapImage?.height || 0 };
    };

    // --- 3. Clamp & Fit Logic ---
    
    const clampOffset = (targetOffset: {x: number, y: number}, targetScale: number) => {
        const container = containerRef.current;
        if (!container) return targetOffset;

        const { width: mapW, height: mapH } = getMapDimensions();
        if (mapW === 0 || mapH === 0) return targetOffset;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        const scaledMapW = mapW * targetScale;
        const scaledMapH = mapH * targetScale;

        let newX = targetOffset.x;
        let newY = targetOffset.y;

        // X Axis: Center if smaller, Clamp if larger
        if (scaledMapW <= containerW) {
             newX = (containerW - scaledMapW) / 2;
        } else {
             // range: [containerW - scaledMapW, 0]
             const minX = containerW - scaledMapW;
             const maxX = 0;
             newX = Math.min(Math.max(newX, minX), maxX);
        }

        // Y Axis
        if (scaledMapH <= containerH) {
             newY = (containerH - scaledMapH) / 2;
        } else {
             const minY = containerH - scaledMapH;
             const maxY = 0;
             newY = Math.min(Math.max(newY, minY), maxY);
        }

        return { x: newX, y: newY };
    };

    const fitToScreen = () => {
        const container = containerRef.current;
        if (!container) return;
        const { width, height } = getMapDimensions();
        if (!width || !height) return;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        if (containerW === 0) return;

        const scaleX = (containerW - 40) / width;
        const scaleY = (containerH - 40) / height;
        const fitScale = Math.min(scaleX, scaleY, 5) * 0.9; // 90% fill

        // Apply
        const startOffset = { 
            x: (containerW - width * fitScale) / 2, 
            y: (containerH - height * fitScale) / 2 
        };
        
        setScale(fitScale);
        setOffset(startOffset);
    };

    // --- 4. Auto Fit on Load ---
    useEffect(() => {
        const timer = setInterval(() => {
             const { width } = getMapDimensions();
             const container = containerRef.current;
             if (width > 0 && container && container.clientWidth > 0) {
                 fitToScreen();
                 clearInterval(timer);
             }
        }, 100);
        return () => clearInterval(timer);
    // eslint-disable-next-line
    }, [mapImage, visualStyle, gridMetadata?.width]); // Re-run if map changes


    // --- 5. Event Handlers (Wheel & Drag) ---
    
    // Imperative Wheel Handler for { passive: false }
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();

            // Calculate Zoom
            const zoomFactor = 1.1;
            const delta = -Math.sign(e.deltaY);
            // Limit Zoom Speed
            const scaleMul = delta > 0 ? zoomFactor : (1 / zoomFactor);
            
            // Current Scale / Offset (Captured via refs or dependency re-bind)
            const newScaleRaw = scale * scaleMul;
            
            // Limit Min/Max Scale
            const { width: mapW, height: mapH } = getMapDimensions();
            const containerW = container.clientWidth;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _unusedMapH = mapH; // Ack lint
            
            // Fix: Strict Min Scale (Fit to Screen)
            // Do NOT allow zooming out smaller than the container fit (no 0.1 factor)
            const fitScale = Math.min(containerW / (mapW || 1), 1);
            const minScale = fitScale; 

            // Clamp Scale using stricter minScale
            const newScale = Math.min(Math.max(newScaleRaw, minScale), 5);

            // Cursor Centered Zoom Math
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // mapX = (mouseX - offset.x) / scale
            const mapX = (mouseX - offset.x) / scale;
            const mapY = (mouseY - offset.y) / scale;

            // newOffset.x = mouseX - mapX * newScale
            const newOffsetX = mouseX - (mapX * newScale);
            const newOffsetY = mouseY - (mapY * newScale);

            // Apply Clamp
            const finalOffset = clampOffset({x: newOffsetX, y: newOffsetY}, newScale);

            setScale(newScale);
            setOffset(finalOffset);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    // Added missing dependencies to prevent stale closures
    }, [scale, offset, mapImage, visualStyle, gridMetadata]);

    
    // Formatting Pan Handlers
    const handleMouseDown = (e: MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        const targetOffset = {
            x: offset.x + deltaX,
            y: offset.y + deltaY
        };

        const finalOffset = clampOffset(targetOffset, scale);
        
        setOffset(finalOffset);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);


    // Click Handler (Coordinates)
    const handleClick = (e: MouseEvent) => {
        if (isDragging) return; 
        
        if (!meta || !mapImage || !onMapClick) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if(!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        // Bounds check
        if (canvasX < 0 || canvasX > mapImage.width || canvasY < 0 || canvasY > mapImage.height) return;

        const world = pixelToWorld({x: canvasX, y: canvasY}, meta, mapImage.height);
        onMapClick(world);
    };

    
    // --- 6. Notify Parent ---
    useEffect(() => {
         const { width, height } = getMapDimensions();
         if (width && height && onMapLoad) {
             const metaToPass = meta || {
                 image: 'abstract',
                 resolution: gridMetadata?.resolution || 0.05,
                 origin: [0,0,0],
                 negate: false,
                 occupied_thresh: 0.5,
                 free_thresh: 0.5,
                 mode: 'raw' as const
             };
            onMapLoad({ meta: metaToPass, width, height });
        }
    }, [mapImage, meta, visualStyle]); // Notify when ready


    // --- 7. Render ---
    const isLoading = visualStyle === 'default' && (isMetaLoading || isImageLoading);

    // Canvas Rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { width, height } = getMapDimensions();
        canvas.width = width;
        canvas.height = height;

        // Draw Logic
        if (visualStyle === 'abstract') {
            drawAbstractGrid(ctx, width, height, gridMetadata?.resolution || 0.05);
        } else if (mapImage) {
            // Background
            ctx.fillStyle = '#330000';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(mapImage, 0, 0);
        }

    }, [mapImage, visualStyle, gridMetadata]); // Re-draw on resource change

    return (
        <div 
            ref={containerRef}
            className={`relative overflow-hidden bg-[#020408] select-none ${className}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-accent-cyan animate-spin" />
                 </div>
            )}

            <div 
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden'
                }}
            >
                <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />
                
                {/* Children Overlay (Graph, Aircraft) */}
                <div className="absolute inset-0">
                    {children}
                </div>
            </div>

            {/* Debug HUD */}
            <div className="absolute bottom-4 right-4 pointer-events-none bg-black/60 text-[10px] text-accent-cyan font-mono px-2 py-1 rounded border border-white/10">
                ZOOM: {(scale * 100).toFixed(0)}%
                <span className="mx-2">|</span>
                POS: {offset.x.toFixed(0)}, {offset.y.toFixed(0)}
            </div>
        </div>
    );
}

// Helper: Draw Abstract Grid
function drawAbstractGrid(ctx: CanvasRenderingContext2D, w: number, h: number, res: number) {
    ctx.clearRect(0, 0, w, h);
    
    // Grid logic
    const gridSizeMajor = 10 / res; 
    const gridSizeMinor = 1 / res;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    for (let x=0; x<=w; x+=gridSizeMinor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMinor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.beginPath();
    for (let x=0; x<=w; x+=gridSizeMajor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMajor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();
}
