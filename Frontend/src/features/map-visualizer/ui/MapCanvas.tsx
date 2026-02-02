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
    initialViewBox, onMapLoad, onMapClick, className, children 
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

        const scaledMapW = mapW * targetScale;
        const scaledMapH = mapH * targetScale;

        let newX = targetOffset.x;
        let newY = targetOffset.y;

        // X Axis
        if (scaledMapW <= containerW) {
            newX = (containerW - scaledMapW) / 2;
        } else {
            const minX = containerW - scaledMapW;
            newX = Math.min(Math.max(newX, minX), 0);
        }

        // Y Axis
        if (scaledMapH <= containerH) {
            newY = (containerH - scaledMapH) / 2;
        } else {
            const minY = containerH - scaledMapH;
            newY = Math.min(Math.max(newY, minY), 0);
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

        // 1. 초기 뷰박스가 있으면 그것을 기준으로 맞춤
        if (initialViewBox) {
            // ViewBox Width/Height를 화면에 맞춤
            const scaleX = containerW / initialViewBox.width;
            const scaleY = containerH / initialViewBox.height;
            const fitScale = Math.min(scaleX, scaleY); // 꽉 차게 하려면 max, 다 보이게 하려면 min

            // Offset 계산: 뷰박스의 시작점(x,y)이 화면 (0,0)에 오도록 하고 스케일 적용
            // Target: (0,0) of container should map to (ivb.x * scale, ivb.y * scale) relative to map origin?
            // No.
            // Map Origin (0,0) is drawing at `offset`.
            // We want `initialViewBox.x` to be at Container(0).
            // ContainerX = OffsetX + MapX * Scale
            // 0 = OffsetX + ivb.x * Scale => OffsetX = -ivb.x * Scale
            
            // Center the ViewBox in Container if Aspect Ratio differs
            const centeredOffsetX = (containerW - initialViewBox.width * fitScale) / 2;
            const centeredOffsetY = (containerH - initialViewBox.height * fitScale) / 2;

            setScale(fitScale);
            setOffset({
                x: -initialViewBox.x * fitScale + centeredOffsetX,
                y: -initialViewBox.y * fitScale + centeredOffsetY
            });
            return;
        }

        // 2. 없으면 전체 맵 맞춤 (기존 로직)
        const scaleX = (containerW - 40) / width;
        const scaleY = (containerH - 40) / height;
        const fitScale = Math.min(scaleX, scaleY, 5) * 0.9; 

        const startOffset = { 
            x: (containerW - width * fitScale) / 2, 
            y: (containerH - height * fitScale) / 2 
        };
        
        setScale(fitScale);
        setOffset(startOffset);
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
    }, [mapImage, visualStyle, gridMetadata?.width, initialViewBox]); // 의존성 추가

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
            
            // Min Scale: 컨테이너보다 작아지지 않게
            const { width: mapW } = getMapDimensions();
            const containerW = container.clientWidth;
            const minScale = Math.min(containerW / (mapW || 1), 1);
            
            const newScale = Math.min(Math.max(newScaleRaw, minScale), 10);

            // Zoom Center Logic
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const mapX = (mouseX - offset.x) / scale;
            const mapY = (mouseY - offset.y) / scale;
            
            const newOffsetX = mouseX - (mapX * newScale);
            const newOffsetY = mouseY - (mapY * newScale);
            
            // 뷰박스 제한이 있다면 여기서 clampOffset을 initialViewBox 기준으로 해야 하나,
            // 일단 전체 맵 Clamp만 적용
            const finalOffset = clampOffset({x: newOffsetX, y: newOffsetY}, newScale);

            setScale(newScale);
            setOffset(finalOffset);
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [scale, offset, mapImage, visualStyle, gridMetadata]);

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
