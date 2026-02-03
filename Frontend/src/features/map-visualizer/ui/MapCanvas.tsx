import { useEffect, useRef, useState, useLayoutEffect, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { type MapMeta, type WorldCoord } from "@/entities/map/model/types";
import { pixelToWorld } from "@/entities/map/lib/coordinate";

interface MapCanvasProps {
    // Data (Optional: if not provided, just renders grid)
    mapImage: CanvasImageSource | null;
    meta: MapMeta | null;
    
    // Config
    visualStyle?: 'default' | 'abstract' | undefined;
    gridMetadata?: { width: number; height: number; resolution: number; } | undefined; 
    
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
 * 데이터 로딩 로직을 제거하고, 순수하게 렌더링 및 뷰포트 제어만 담당합니다.
 */
export function MapCanvas({ 
    mapImage, meta, visualStyle = 'default', gridMetadata, 
    initialViewBox, maxBounds, onMapLoad, onMapClick, className, children 
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
        
        // 1. VideoFrame (Standard)
        if ('displayWidth' in source) {
            return { width: source.displayWidth, height: source.displayHeight };
        }
        
        // 2. HTMLVideoElement
        if ('videoWidth' in source) {
            return { width: source.videoWidth, height: source.videoHeight };
        }
        
        // 3. HTMLImageElement, ImageBitmap, HTMLCanvasElement, OffscreenCanvas
        if ('width' in source && 'height' in source) {
            // SVGImageElement의 경우 width가 object(SVGAnimatedLength)일 수 있음. 이를 숫자로 변환.
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
        // "Seeing" maxBounds means:
        // Top-Left of ViewPort >= maxBounds.x
        // Bottom-Right of ViewPort <= maxBounds.x + width
        
        // BUT, offset logic is: MapOrigin + offset = Screen(0,0)
        // So offset determines where (0,0) of map is on screen.
        // Map Point P on screen = P * scale + offset
        
        // Constraint: We want Visible Area (Screen Rect 0,0 to W,H) to be contained within MaxBounds?
        // OR We want MaxBounds to be contained within Visible Area (Zoom Out Limit)?
        // User said: "Cannot go OUTSIDE that area". Meaning the user can never see points outside maxBounds.
        // Implies: The Viewer Viewport must always overlap with MaxBounds? 
        // Or simpler: The visible viewport must NOT show anything outside maxBounds?
        // Actually, "cannot go outside" usually means the VIEWPORT is CLAMPED to the BOUNDS.
        // i.e., I cannot pan such that I see the "void" outside the bounds.
        
        // Let's implement standard "Contain" behavior for maxBounds.
        // The visible screen rectangle (in map space) must be inside maxBounds? No, that's max zoom out limit.
        // Usually: The Bounds Rectangle (in screen space) must cover the Screen Rectangle (if zoomed in).
        // If zoomed out (Bounds < Screen), center it.
        
        const effectiveBounds = maxBounds || { x: 0, y: 0, width: mapW, height: mapH };
        
        const boundsLeft = effectiveBounds.x * targetScale + targetOffset.x;
        const boundsTop = effectiveBounds.y * targetScale + targetOffset.y;
        const boundsW = effectiveBounds.width * targetScale;
        const boundsH = effectiveBounds.height * targetScale;
        
        let newX = targetOffset.x;
        let newY = targetOffset.y;

        // X Axis
        if (boundsW <= containerW) {
            // If the bounds is smaller than screen, Center it (or align left?)
            // Usually center.
            const centeredLeft = (containerW - boundsW) / 2;
            // newX must result in boundsLeft = centeredLeft
            // centeredLeft = effectiveBounds.x * scale + newX
            newX = centeredLeft - (effectiveBounds.x * targetScale);
        } else {
            // Bounds is larger than screen.
            // Screen Left (0) >= Bounds Left
            // Screen Right (containerW) <= Bounds Right (BoundsLeft + BoundsW)
            
            // 1. Screen Left >= Bounds Left
            // 0 >= effectiveBounds.x * scale + newX  => newX <= -effectiveBounds.x * scale
            const maxOffset = -effectiveBounds.x * targetScale;
            
            // 2. Screen Right <= Bounds Right
            // containerW <= effectiveBounds.x * scale + newX + boundsW
            // newX >= containerW - boundsW - effectiveBounds.x * scale
            const minOffset = containerW - boundsW - (effectiveBounds.x * targetScale);
            
            newX = Math.min(Math.max(newX, minOffset), maxOffset);
        }

        // Y Axis
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

        // Priority 1: initialViewBox (Specific initial look)
        // Priority 2: maxBounds (Fit to bounds)
        // Priority 3: Full Map
        
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
    }, [mapImage, visualStyle, gridMetadata?.width, initialViewBox, maxBounds]); // 의존성 추가

    // --- Event Handlers ---
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            const delta = -Math.sign(e.deltaY);
            const scaleMul = delta > 0 ? zoomFactor : (1 / zoomFactor);
            const newScaleRaw = scale * scaleMul;
            
            // Min Scale: 컨테이너보다 작아지지 않게 (Respect Constraints)
            // If maxBounds is set, minScale is fitting maxBounds to container.
            const effectiveBounds = maxBounds || { width: getMapDimensions().width, height: getMapDimensions().height };
            
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;
            
            const minScaleX = containerW / effectiveBounds.width;
            const minScaleY = containerH / effectiveBounds.height;
            const minScale = Math.min(minScaleX, minScaleY); // Fit entirely visible
            
            const newScale = Math.min(Math.max(newScaleRaw, minScale), 10);

            // Zoom Center Logic
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const mapX = (mouseX - offset.x) / scale;
            const mapY = (mouseY - offset.y) / scale;
            
            const newOffsetX = mouseX - (mapX * newScale);
            const newOffsetY = mouseY - (mapY * newScale);
            
            const finalOffset = clampOffset({x: newOffsetX, y: newOffsetY}, newScale);

            setScale(newScale);
            setOffset(finalOffset);
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        // Touch gestures? (Future improvement)
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

        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        const { width, height } = getSourceDimensions(mapImage);
        if (canvasX < 0 || canvasX > width || canvasY < 0 || canvasY > height) return;

        const world = pixelToWorld({x: canvasX, y: canvasY}, meta, height);
        onMapClick(world);
    };

    // --- Render ---
    // Draw Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { width, height } = getMapDimensions();
        canvas.width = width;
        canvas.height = height;

        if (visualStyle === 'abstract') {
            drawAbstractGrid(ctx, width, height, gridMetadata?.resolution || 0.05);
        } else if (mapImage) {
            ctx.fillStyle = '#1A1D21'; // Darker bg
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(mapImage, 0, 0);
        }
    }, [mapImage, visualStyle, gridMetadata]);

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
            <div 
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                }}
            >
                <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />
                <div className="absolute inset-0">
                    {children}
                </div>
            </div>
            
            {/* Debug HUD (Optional) */}
             <div className="absolute bottom-4 right-4 pointer-events-none bg-black/60 text-[10px] text-accent-cyan font-mono px-2 py-1 rounded border border-white/10">
                 ZOOM: {(scale * 100).toFixed(0)}%
             </div>
        </div>
    );
}

function drawAbstractGrid(ctx: CanvasRenderingContext2D, w: number, h: number, res: number) {
    ctx.clearRect(0, 0, w, h);
    const gridSizeMajor = 10 / res; 
    const gridSizeMinor = 1 / res;
    
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x=0; x<=w; x+=gridSizeMinor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMinor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    for (let x=0; x<=w; x+=gridSizeMajor) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for (let y=0; y<=h; y+=gridSizeMajor) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();
}
