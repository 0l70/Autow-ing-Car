import React, { useEffect, useRef, useState, useLayoutEffect, type MouseEvent } from "react";
import { type MapMeta, type WorldCoord } from "@/entities/map/model/types";
import { pixelToWorld } from "@/entities/map/lib/coordinate";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

// --- Context for Children to sync with Camera ---
export const MapCameraContext = React.createContext<{
    scale: number;
    offset: { x: number; y: number };
    viewport: { x: number; y: number; width: number; height: number };
} | null>(null);

export function useMapCamera() {
    const context = React.useContext(MapCameraContext);
    if (!context) throw new Error("useMapCamera must be used within MapCanvas");
    return context;
}

export interface GridOptions {
    majorInterval?: number; // meters (default: 10)
    minorInterval?: number; // meters (default: 1)
    majorColor?: string;
    minorColor?: string;
    majorWidth?: number;
    minorWidth?: number;
}

interface MapCanvasProps {
    // Data (Optional: if not provided, just renders grid)
    mapImage: CanvasImageSource | null;
    meta: MapMeta | null;
    
    // Config
    visualStyle?: 'default' | 'abstract' | undefined;
    gridMetadata?: { width: number; height: number; resolution: number; } | undefined; 
    gridOptions?: GridOptions | undefined; 
    pixelRatio?: number | undefined; // [New] High-DPI Scaling Factor (Default: 1)
    
    // Viewport Control (Optional)
    initialViewBox?: { x: number; y: number; width: number; height: number; } | undefined;
    maxBounds?: { x: number; y: number; width: number; height: number; } | undefined;
    
    // Events
    onMapLoad?: ((info: { width: number; height: number }) => void) | undefined;
    onMapClick?: ((worldPos: WorldCoord) => void) | undefined;
    
    className?: string | undefined;
    children?: React.ReactNode | undefined;
}

/**
 * 컴포넌트: 맵 캔버스 (공통)
 * Viewport Rendering Architecture:
 * - Container is fixed size (Screen).
 * - Canvas is fixed size (Screen).
 * - "World" is transformed via Context & 2D Context.
 */
export function MapCanvas({ 
    mapImage, meta, visualStyle = 'default', gridMetadata, 
    initialViewBox, maxBounds, gridOptions, pixelRatio = 1, onMapLoad, onMapClick, className, children 
}: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Viewport State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // --- Helper: Dimensions ---
    const getSourceDimensions = (source: CanvasImageSource | null) => {
        if (!source) return { width: 0, height: 0 };
        
        if ('displayWidth' in source) return { width: source.displayWidth, height: source.displayHeight };
        if ('videoWidth' in source) return { width: source.videoWidth, height: source.videoHeight };
        
        if ('width' in source && 'height' in source) {
            const w = typeof source.width === 'number' ? source.width : source.width.baseVal.value;
            const h = typeof source.height === 'number' ? source.height : source.height.baseVal.value;
            return { width: w, height: h };
        }
        return { width: 0, height: 0 };
    };

    const getMapDimensions = () => {
        if (visualStyle === 'abstract') {
            return { width: gridMetadata?.width || 2000, height: gridMetadata?.height || 1500 };
        }
        return getSourceDimensions(mapImage);
    };

    // --- Helper: Clamp & Fit ---
    const clampOffset = (targetOffset: {x: number, y: number}, targetScale: number) => {
        const container = containerRef.current;
        if (!container) return targetOffset;

        const { width: mapW, height: mapH } = getMapDimensions();
        if (mapW === 0 || mapH === 0) return targetOffset;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        // If maxBounds is defined, restricting "Camera" inside bounds
        const effectiveBounds = maxBounds || { x: 0, y: 0, width: mapW, height: mapH };
        
        // Calculate Logic Bounds in Screen Space
        const boundsW = effectiveBounds.width * targetScale;
        const boundsH = effectiveBounds.height * targetScale;
        
        let newX = targetOffset.x;
        let newY = targetOffset.y;

        // X Axis Logic
        if (boundsW <= containerW) {
            // Keep centered if smaller than screen
            const centeredLeft = (containerW - boundsW) / 2;
            // The Offset required to place the bounds at centeredLeft
            // offset + (bounds.x * scale) = centeredLeft
            newX = centeredLeft - (effectiveBounds.x * targetScale);
        } else {
            // Pan limits
            // min X (Right side aligns with right side of screen) -> containerW - boundsW - (bounds.x * scale)
            // max X (Left side aligns with left side of screen) -> -(bounds.x * scale)
            const maxOffset = -effectiveBounds.x * targetScale;
            const minOffset = containerW - boundsW - (effectiveBounds.x * targetScale);
            newX = Math.min(Math.max(newX, minOffset), maxOffset);
        }

        // Y Axis Logic
        if (boundsH <= containerH) {
            const centeredTop = (containerH - boundsH) / 2;
            newY = centeredTop - (effectiveBounds.y * targetScale);
        } else {
            const maxOffset = -effectiveBounds.y * targetScale;
            const minOffset = containerH - boundsH - (effectiveBounds.y * targetScale);
            newY = Math.min(Math.max(newY, minOffset), maxOffset);
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

        const targetBox = initialViewBox || maxBounds || { x: 0, y: 0, width, height };

        // ViewBox Width/Height를 화면에 맞춤
        const scaleX = containerW / targetBox.width;
        const scaleY = containerH / targetBox.height;
        const fitScale = Math.min(scaleX, scaleY); // Fit inside

        // Center logic
        const centeredOffsetX = (containerW - targetBox.width * fitScale) / 2;
        const centeredOffsetY = (containerH - targetBox.height * fitScale) / 2;

        setScale(fitScale);
        setOffset({
            x: -targetBox.x * fitScale + centeredOffsetX,
            y: -targetBox.y * fitScale + centeredOffsetY
        });
    };

    // --- Init Effect ---
    useEffect(() => {
        const { width, height } = getMapDimensions();
        const container = containerRef.current;
        
        // 데이터 로드 완료 확인
        if (width > 0 && container && container.clientWidth > 0) {
            // 약간의 지연 후 핏 (레이아웃 안정화)
            const timer = setTimeout(() => {
                fitToScreen();
                if (onMapLoad) onMapLoad({ width, height });
            }, 50);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line
    }, [mapImage, visualStyle, gridMetadata?.width, gridMetadata?.height, 
        initialViewBox?.x, initialViewBox?.y, initialViewBox?.width, initialViewBox?.height,
        maxBounds?.x, maxBounds?.y, maxBounds?.width, maxBounds?.height]); 

    // --- Event Handlers ---
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            const delta = -Math.sign(e.deltaY); // -1 or 1
            const scaleMul = delta > 0 ? zoomFactor : (1 / zoomFactor);
            const newScaleRaw = scale * scaleMul;
            
            const effectiveBounds = maxBounds || { width: getMapDimensions().width, height: getMapDimensions().height };
            
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;
            
            const minScaleX = containerW / effectiveBounds.width;
            const minScaleY = containerH / effectiveBounds.height;
            const minScale = Math.min(minScaleX, minScaleY) * 0.5; // Allow zooming out a bit more than fit
            
            const newScale = Math.min(Math.max(newScaleRaw, minScale), 50); // Allow huge zoom for High Res

            // Zoom Center Logic
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Map Point under mouse before zoom
            const mapX = (mouseX - offset.x) / scale;
            const mapY = (mouseY - offset.y) / scale;
            
            // New offset to keep mapX under mouseX at newScale
            // mouseX = newOffset + mapX * newScale
            const newOffsetX = mouseX - (mapX * newScale);
            const newOffsetY = mouseY - (mapY * newScale);
            
            // We clamp AFTER calculating the desired zoom to avoid "sticking" edges weirdly during zoom
            const finalOffset = clampOffset({x: newOffsetX, y: newOffsetY}, newScale);

            setScale(newScale);
            setOffset(finalOffset);
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        // Touch events for mobile support (Pinch/Zoom) could be added here
        return () => container.removeEventListener('wheel', onWheel);
    }, [scale, offset, mapImage, visualStyle, gridMetadata, maxBounds]);

    const handleMouseDown = (e: MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        const targetOffset = { x: offset.x + deltaX, y: offset.y + deltaY };
        // We clamp while dragging to keep user in bounds
        setOffset(clampOffset(targetOffset, scale));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleClick = (e: MouseEvent) => {
        if (isDragging) return; 
        if (!meta || !mapImage || !onMapClick) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if(!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Screen -> World
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        const { width: mapW, height: mapH } = getMapDimensions();
        if (canvasX < 0 || canvasX > mapW || canvasY < 0 || canvasY > mapH) return;

        // The "Pixel" here is the Virtual Map Pixel.
        const world = pixelToWorld({x: canvasX, y: canvasY}, meta, mapH);
        onMapClick(world);
    };

    // Calculate Viewport (Visible Area in Map Space)
    const viewport = {
        x: -offset.x / scale,
        y: -offset.y / scale,
        width: containerRef.current ? containerRef.current.clientWidth / scale : 0,
        height: containerRef.current ? containerRef.current.clientHeight / scale : 0
    };

    // --- Render ---
    // Draw Canvas (Grid / Background)
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !container) return;

        // Canvas matches Container Size (Screen Size)
        const screenW = container.clientWidth;
        const screenH = container.clientHeight;
        if(screenW === 0 || screenH === 0) return;

        canvas.width = screenW * pixelRatio;
        canvas.height = screenH * pixelRatio;
        canvas.style.width = `${screenW}px`;
        canvas.style.height = `${screenH}px`;
        
        // Reset Transform (Standard Identity)
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // Apply DPI Scale
        ctx.scale(pixelRatio, pixelRatio);
        
        // Apply Camera Transform
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        const { width: mapW, height: mapH } = getMapDimensions();

        if (visualStyle === 'abstract') {
            // Draw Abstract Grid
            drawAbstractGrid(ctx, mapW, mapH, gridMetadata?.resolution || 0.05, gridOptions);
        } else if (mapImage) {
            ctx.fillStyle = '#1A1D21';
            ctx.fillRect(0, 0, mapW, mapH);
            ctx.drawImage(mapImage, 0, 0);
        }
    }, [mapImage, visualStyle, gridMetadata, gridOptions, pixelRatio, offset, scale]);

    return (
        <MapCameraContext.Provider value={{ scale, offset, viewport }}>
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
                {/* Background Canvas (Grid / Image) */}
                <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 pointer-events-none"
                    style={{ 
                        imageRendering: 'pixelated', // Keep it sharp
                        zIndex: MAP_CONFIG.Z_INDEX.BASE_MAP
                        // Width/Height are set via JS to match parent
                    }} 
                />
                
                {/* Children Layer (SVG Graphs, etc) */}
                {/* Children must use useMapCamera() to sync with the camera */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {children}
                </div>
                
                {/* Debug HUD */}
                <div 
                    className="absolute bottom-4 right-4 pointer-events-none bg-black/60 text-[10px] text-accent-cyan font-mono px-2 py-1 rounded border border-white/10"
                    style={{ zIndex: MAP_CONFIG.Z_INDEX.UI_OVERLAY }}
                >
                    ZOOM: {(scale * 100).toFixed(0)}%
                </div>
            </div>
        </MapCameraContext.Provider>
    );
}

function drawAbstractGrid(
    ctx: CanvasRenderingContext2D, 
    w: number, 
    h: number, 
    res: number, 
    options?: GridOptions
) {
    // Only clear if we were redrawing the whole canvas, but we did that in useEffect via resizing.
    // However, since we are inside a specific transform, we should be careful.
    // Actually, canvas.width/height reset clears it.
    
    // Default Values
    const majorMeters = options?.majorInterval ?? 10;
    const minorMeters = options?.minorInterval ?? 1;
    
    const gridSizeMajor = majorMeters / res; 
    const gridSizeMinor = minorMeters / res;
    
    // Draw only visible grid could be an optimization here, but for now we draw all.
    // Canvas handles clipping off-screen quite well.
    
    // Minor Grid
    ctx.beginPath();
    ctx.lineWidth = options?.minorWidth ?? 1;
    // Scale stroke width inverse to zoom to keep it consistent on screen? 
    // No, grid lines should get thicker as we zoom in (real world meters).
    // So fixed width in world space is correct.
    
    ctx.strokeStyle = options?.minorColor ?? 'rgba(255, 255, 255, 0.05)';
    for (let x=0; x<=w; x+=gridSizeMinor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMinor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();

    // Major Grid
    ctx.beginPath();
    ctx.lineWidth = options?.majorWidth ?? 2;
    ctx.strokeStyle = options?.majorColor ?? 'rgba(0, 255, 255, 0.1)';
    for (let x=0; x<=w; x+=gridSizeMajor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMajor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();
}
