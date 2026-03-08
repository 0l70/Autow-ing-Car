import { useEffect, useRef } from "react";
import { Aircraft, MapMeta } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useAircraftStore } from "@/entities/aircraft";
import { useSmoothAnimation } from "@/features/map-visualizer/lib/useSmoothAnimation";

// Colors for status
// Colors for status
const STATUS_COLORS: Record<string, string> = {
    IDLE: '#FFA500',             // Orange: Standby
    MOVING_TO_GATE: '#00FF00',   // Green: Moving to Task
    DOCKING: '#00FFFF',          // Cyan: Precise Maneuver
    TOWING: '#D946EF',           // Fuchsia: Heavy Load
    UNDOCKING: '#00FFFF',        // Cyan: Precise Maneuver
    WAITING_FOR_RETURN: '#FACC15', // Yellow: Holding
    RETURNING: '#3B82F6',        // Blue: Returning Home
    STOP: '#FF0000',             // Red: Emergency/Stop
    ERROR: '#FF0000'             // Red: Error
};

interface AircraftLayerProps {
    meta: MapMeta | null;
    mapWidth: number;
    mapHeight: number;
    pixelRatio?: number; // [New] High-DPI Support
    data?: Aircraft[]; // [New] Optional external data source
    onAircraftClick?: (aircraft: Aircraft) => void;
}

// Constants for Interaction and Animation
const CLICK_RADIUS_SQ = 400; // 20px * 20px
const ANIMATION_DURATION_MS = 300;


export function AircraftLayer({ meta, mapWidth, mapHeight, pixelRatio = 1, data, onAircraftClick }: AircraftLayerProps) {
    const storeAircraftList = useAircraftStore((state) => state.aircrafts);
    
    // [Update] Data Injection Logic
    // If external 'data' prop is provided (e.g., filtered list for Pilot), use it.
    // Otherwise, fallback to the global store (for ATC).
    const displayData = data || storeAircraftList;
    
    // Apply Smooth Animation (Interpolation)
    const animatedList = useSmoothAnimation(displayData, ANIMATION_DURATION_MS);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (!onAircraftClick || !canvasRef.current || !meta) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        
        // [Fix] Calculate Scale Factor (Logical Size / Visual Size)
        // usage: visual_pixel * scale = logical_pixel
        const scaleX = mapWidth / rect.width;
        const scaleY = mapHeight / rect.height;

        // Mouse coordinates relative to logical size (CSS size)
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        for (const ac of animatedList) {
             const pixel = worldToPixel(ac.position, meta, mapHeight);
             // Distance squared (radius check) in logical pixels
             const distSq = (mouseX - pixel.x) ** 2 + (mouseY - pixel.y) ** 2;
             if (distSq < CLICK_RADIUS_SQ) { 
                 onAircraftClick(ac);
                 return;
             }
        }
    };

    useEffect(() => {
        if (!meta || mapHeight === 0 || mapWidth === 0 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // [DEBUG] Check render context
        // console.log(`[AircraftLayer] Rendering... Meta: ${!!meta}, W: ${mapWidth}, H: ${mapHeight}, Count: ${animatedList.length}`);
        if(animatedList.length > 0) {
            // console.log(`[AircraftLayer] First Car:`, animatedList[0]);
        }
        
        // [New] High-DPI Scaling
        canvas.width = mapWidth * pixelRatio;
        canvas.height = mapHeight * pixelRatio;
        
        // Scale Context to match logical coordinates
        ctx.scale(pixelRatio, pixelRatio);

        // Clear in logical coordinates (0 to width, 0 to height)
        // Note: clearRect affects the underlying pixels. 
        // If we scaled, 0,0,w,h covers 0,0,w*ratio,h*ratio ?
        // Context scale transforms drawing operations. 
        // clearRect(x,y,w,h) clears the rectangle [x,y,w,h] in the *current coordinate system*.
        // So clearing (0,0,mapWidth,mapHeight) is correct because we scaled up.
        ctx.clearRect(0, 0, mapWidth, mapHeight);

        animatedList.forEach(ac => {
            const pixel = worldToPixel(ac.position, meta, mapHeight);
            // console.log(`[AircraftLayer] Car ${ac.id}: World(${ac.position.x.toFixed(2)}, ${ac.position.y.toFixed(2)}) -> Pixel(${pixel.x.toFixed(0)}, ${pixel.y.toFixed(0)})`);
            
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Rotation Correction: 
            // -ac.position.r is generally correct for converting Math Angle (CCW) to Canvas (CW Y-down)
            // Assuming ac.position.r comes in Radians.
            ctx.rotate(-ac.position.r); 

            // Draw Body
            let color = STATUS_COLORS[ac.status] || '#FFFFFF';
            let blur = 10;
            const labelText = ac.callsign;

            // [ATC Visualization] Towing State = Active Glow
            if (ac.isLoaded) {
                color = '#FFFFFF'; // Body is White
                ctx.shadowColor = '#00FF00'; // Neon Green Glow
                blur = 30; // Strong Pulse
                // Removed '(TOW)' suffix to reduce label size
            } else {
                ctx.shadowColor = color;
            }

            ctx.fillStyle = color;
            ctx.shadowBlur = blur;
            
            ctx.beginPath();
            // Triangle pointing East (0 deg)
            // Reduced size by 1/4 (20 -> 5)
            ctx.moveTo(5, 0);      // Nose (Front)
            ctx.lineTo(-3.75, 3);  // Left Wing (12 -> 3)
            ctx.lineTo(-2, 0);     // Tail Indent (-8 -> -2)
            ctx.lineTo(-3.75, -3); // Right Wing (-12 -> -3)
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset
            ctx.restore();
            
            // Label (Non-rotated with HUD Background)
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Text Settings
            ctx.font = 'bold 8px sans-serif'; // Smaller, Bolder
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top'; // Align top to push down from aircraft
            
            // const textMetrics = ctx.measureText(labelText);
            // const textWidth = textMetrics.width;
            
            // Transparent Background (Requested)
            // ctx.fillStyle = 'rgba(0, 0, 0, 0)'; 
            // ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            // ctx.shadowBlur = 0;
            
            // Text (White with heavy shadow/stroke for contrast)
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(labelText, 0, 8); // Stroke first

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, 0, 8); // Fill second

            ctx.restore();
        });

    }, [animatedList, meta, mapWidth, mapHeight, pixelRatio]);

    return (
        <canvas 
            ref={canvasRef}
            // Logical size for layout
            style={{ width: mapWidth, height: mapHeight }}
            // Physical size set in useEffect (but we can default or omit here since useEffect overrides)
            // But React might complain if we don't set width/height attributes initially? 
            // Actually, best to let useEffect manage the internal size buffer.
            // But simple way is:
            width={mapWidth * pixelRatio} 
            height={mapHeight * pixelRatio}
            className="absolute inset-0 z-50 cursor-pointer pointer-events-auto"
            onClick={handleClick}
        />
    );
}
