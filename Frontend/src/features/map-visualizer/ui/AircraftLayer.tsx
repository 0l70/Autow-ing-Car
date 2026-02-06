import { useEffect, useRef } from "react";
import { Aircraft, MapMeta } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useAircraftStore } from "@/entities/aircraft";
import { useSmoothAnimation } from "@/features/map-visualizer/lib/useSmoothAnimation";
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";

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
    mapHeight: number; // Logical World Height (High Res)
    mapWidth: number; // Logical World Width (High Res)
    pixelRatio?: number; // [New] High-DPI Support
    data?: Aircraft[]; // [New] Optional external data source
    onAircraftClick?: (aircraft: Aircraft) => void;
}

// Constants for Interaction and Animation
const CLICK_RADIUS_SQ = 400; // 20px * 20px
const ANIMATION_DURATION_MS = 300;


export function AircraftLayer({ meta, mapHeight, mapWidth, pixelRatio = 1, data, onAircraftClick }: AircraftLayerProps) {
    const storeAircraftList = useAircraftStore((state) => state.aircrafts);
    const { scale, offset, viewport } = useMapCamera();
    
    // [Update] Data Injection Logic
    const displayData = data || storeAircraftList;
    
    // Apply Smooth Animation (Interpolation)
    const animatedList = useSmoothAnimation(displayData, ANIMATION_DURATION_MS);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (!onAircraftClick || !canvasRef.current || !meta) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        
        // Mouse coordinates relative to Viewport
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert User Click (Screen) -> World
        // Screen = World * Scale + Offset
        // World = (Screen - Offset) / Scale
        const worldClickX = (mouseX - offset.x) / scale;
        const worldClickY = (mouseY - offset.y) / scale;

        // However, we are comparing against Aircraft Position which is "Pixel Coords" (worldToPixel)
        // worldToPixel returns Logical Pixel Coords.
        // So we need to match spaces.
        
        for (const ac of animatedList) {
             const pixel = worldToPixel(ac.position, meta, mapHeight);
             
             // Pixel is in Logical World Space.
             // We can compare in World Space OR Screen Space.
             
             // Let's compare in Logical World Space.
             // Radius check: 20px in SCREEN space? Or World space?
             // Usually we want clickable area to be fixed screen size (e.g. 20px).
             // So let's project Aircraft to Screen Space.
             
             const screenX = pixel.x * scale + offset.x;
             const screenY = pixel.y * scale + offset.y;
             
             const distSq = (mouseX - screenX) ** 2 + (mouseY - screenY) ** 2;
             
             if (distSq < CLICK_RADIUS_SQ) { 
                 onAircraftClick(ac);
                 return;
             }
        }
    };

    useEffect(() => {
        if (!meta || mapHeight === 0 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const parent = canvas.parentElement;
        if (!parent) return;
        
        const screenW = parent.clientWidth;
        const screenH = parent.clientHeight;
        
        // [New] High-DPI Scaling & Viewport Size
        canvas.width = screenW * pixelRatio;
        canvas.height = screenH * pixelRatio;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        // Reset Transform
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // Scale for DPI
        ctx.scale(pixelRatio, pixelRatio);
        
        // Apply Camera Transform
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Clear Screen Rect? 
        // We transformed the context. Clearing (0,0,W,H) clears World(0,0,W,H).
        // If we want to clear the SCREEN, we should use identity transform or calculate inverse.
        // Easiest: Reset transform, clear, then apply transform.
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        animatedList.forEach(ac => {
            const pixel = worldToPixel(ac.position, meta, mapHeight);
            
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Rotation Correction: 
            ctx.rotate(-ac.position.r); 

            // Draw Body (Scale Invariant? No, let it scale with map for now, looks naturally anchored)
            // But if super High Res (5x), the drawing commands (5px) will appear tiny relative to the world?
            // No, Logical Pixels are 5x more dense.
            // Drawing 5px at scale 1.0 (Zoomed Out to fit screen) -> 
            // mapHeight=10000. Screen=1000. Scale=0.1.
            // 5px * 0.1 = 0.5px. Too small!
            
            // So we need to compensation scale for ID entities if we want fixed visibility?
            // OR we define dimensions in Meters?
            // Existing code used "Pixels" for drawing (moveTo 5, etc).
            // Users want "High Resolution" -> "Crisp edges".
            // If we use High Res, we should map everything to Meters logically or scale drawing commands.
            
            // Solution: Inverse Scale for fixed size icons.
            const fixedSizeScale = 1 / scale; 
            // Clamp min scale so they don't get too huge when zoomed in?
            // Or just let them be fixed screen size.
            
            ctx.scale(fixedSizeScale, fixedSizeScale);
            
            let color = STATUS_COLORS[ac.status] || '#FFFFFF';
            let blur = 10;
            const labelText = ac.callsign;

            // [ATC Visualization] Towing State = Active Glow
            if (ac.isLoaded) {
                color = '#FFFFFF'; // Body is White
                ctx.shadowColor = '#00FF00'; // Neon Green Glow
                blur = 30; // Strong Pulse
            } else {
                ctx.shadowColor = color;
            }

            ctx.fillStyle = color;
            ctx.shadowBlur = blur;
            
            ctx.beginPath();
            // Triangle pointing East (0 deg)
            ctx.moveTo(10, 0);      // Enlarged base size (was 5)
            ctx.lineTo(-7.5, 6);  
            ctx.lineTo(-4, 0);     
            ctx.lineTo(-7.5, -6); 
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset
            ctx.restore();
            
            // Label (Non-rotated with HUD Background)
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Fixed Size Label
            ctx.scale(fixedSizeScale, fixedSizeScale);

            // Text Settings
            ctx.font = 'bold 12px sans-serif'; // Larger Base Font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top'; 
            
            // Text (White with heavy shadow/stroke for contrast)
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(labelText, 0, 12); 

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, 0, 12); 

            ctx.restore();
        });

    }, [animatedList, meta, mapHeight, pixelRatio, scale, offset]);

    return (
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 z-50 cursor-pointer pointer-events-auto"
            onClick={handleClick}
        />
    );
}
