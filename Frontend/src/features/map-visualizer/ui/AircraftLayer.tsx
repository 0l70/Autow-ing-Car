import { useEffect, useRef } from "react";
import { Aircraft, MapMeta } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useGraphStore } from "@/entities/map/model/store";
import { useSmoothAnimation } from "@/features/map-visualizer/lib/useSmoothAnimation";

// Colors for status
const STATUS_COLORS: Record<string, string> = {
    IDLE: '#FFA500',   // Orange
    MOVING: '#00FF00', // Green (Neon)
    DOCKING: '#00FFFF',// Cyan
    HOLD: '#FFFF00',   // Yellow
    ERROR: '#FF0000'   // Red
};

interface AircraftLayerProps {
    meta: MapMeta | null;
    mapWidth: number;
    mapHeight: number;
    onAircraftClick?: (aircraft: Aircraft) => void;
}

// Constants for Interaction and Animation
const CLICK_RADIUS_SQ = 400; // 20px * 20px
const ANIMATION_DURATION_MS = 300;
const LABEL_OFFSET_Y = 35;

export function AircraftLayer({ meta, mapWidth, mapHeight, onAircraftClick }: AircraftLayerProps) {
    const aircraftList = useGraphStore((state) => state.aircrafts);
    
    // Apply Smooth Animation (Interpolation)
    const animatedList = useSmoothAnimation(aircraftList, ANIMATION_DURATION_MS);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (!onAircraftClick || !canvasRef.current || !meta) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        for (const ac of animatedList) {
             const pixel = worldToPixel(ac.position, meta, mapHeight);
             // Distance squared (radius check)
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

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        animatedList.forEach(ac => {
            const pixel = worldToPixel(ac.position, meta, mapHeight);
            
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Rotation Correction: 
            // World Coordinate System: +Y is UP, +Angle is CCW (Standard Math).
            // Canvas Coordinate System: +Y is DOWN.
            // When rendering World to Canvas, Y is flipped.
            // This flips the coordinate space handedness. 
            // A positive rotation (CCW) in World becomes a positive rotation (CW) in Canvas IF we just map numbers?
            // Wait. Canvas Y is inverted relative to World Y.
            // X is same.
            // Rotation is defined as rotation from X axis towards Y axis usually?
            // In World: X (Right) -> Y (Up) is CCW.
            // In Canvas: X (Right) -> Y (Down) is CW.
            // If an object is rotated +90 deg in World (pointing Up),
            // We want it to point Up in Canvas (which is -Y).
            // In Canvas, -Y is -90 deg (270).
            // So +90 World -> -90 Canvas.
            // So we Negate the angle.
            ctx.rotate(-ac.position.r); 

            // Draw Body
            let color = STATUS_COLORS[ac.status] || '#FFFFFF';
            let blur = 10;
            let labelText = ac.callsign;

            // [ATC Visualization] Towing State = Active Glow
            if (ac.isLoaded) {
                color = '#FFFFFF'; // Body is White
                ctx.shadowColor = '#00FF00'; // Neon Green Glow
                blur = 30; // Strong Pulse
                labelText += ' (TOW)';
            } else {
                ctx.shadowColor = color;
            }

            ctx.fillStyle = color;
            ctx.shadowBlur = blur;
            
            ctx.beginPath();
            // Triangle pointing East (0 deg)
            ctx.moveTo(35, 0);   // Nose
            ctx.lineTo(-25, 20); // Left Wing
            ctx.lineTo(-15, 0);  // Tail Indent
            ctx.lineTo(-25, -20);// Right Wing
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset
            ctx.restore();
            
            // Label
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            // Offset label below aircraft
            ctx.fillText(labelText, 0, 35);
            ctx.restore();
        });

    }, [animatedList, meta, mapWidth, mapHeight]);

    return (
        <canvas 
            ref={canvasRef}
            width={mapWidth}
            height={mapHeight}
            className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
            onClick={handleClick}
        />
    );
}


