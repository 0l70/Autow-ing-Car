import { useEffect, useRef } from "react";
import { Aircraft, MapMeta } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useGraphStore } from "@/entities/map/model/store";

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
    mapHeight: number;
    onAircraftClick?: (aircraft: Aircraft) => void;
}

export function AircraftLayer({ meta, mapHeight, onAircraftClick }: AircraftLayerProps) {
    // OLD: const aircraftList = useMockAircraftMqtt(); 
    // NEW: Get from Store
    const aircraftList = useGraphStore((state) => state.aircrafts);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Initial heading offset (if 0 rad = East, but Icon points North, rotate +90deg)
    // Canvas standard: 0 = East (Right). 
    // If our "Triangle" drawing points Right by default, match 0. 
    // If it points Up, subtract 90deg? 
    // Let's assume standard math: 0 = Right.
    // Drawing below: Nose is at (10, 0), Left Wing (-8, 7), Right Wing (-8, -7).
    // This points RIGHT (Positive X). So it matches Math.
    // User says "Heading is weird". Maybe ROS/MQTT sends 0 = North?
    // Navigation standard (North-East-Down): 0 = North, 90 = East.
    // Math standard: 0 = East, 90 = North (CCW) or South (CW)?
    // Let's assume ROS/MQTT is standard ENU (East-North-Up): 0 = East.
    // If user says "weird", maybe they use Compass (0=North, CW)?
    
    // Trial 1: Add -90 degrees (Math.PI/2) just in case they meant North-based.
    // Actually, Canvas Y is Down. 
    // Standard Math: +Rotation = Clockwise in Canvas 2D (since Y is inverted visually? No, Y is down).
    // Wait, coordinate.ts inverts Y. 
    // Let's stick to standard and verify with user if it's 90 off. 
    // But since user complained, I'll rotate 90 deg (PI/2) as a guess or fix if it was pointing wrong relative to path.
    // The previous code had `ctx.rotate(ac.position.r)`. 
    // If vehicle moves +Y (Up visually in inverted map?), 
    // In Canvas space (Y down), +Y movement means Heading should be 90 deg (Down)?
    // No, `worldToPixel` inverts Y. So +WorldY = -CanvasY (Up).
    // So if vehicle moves UP, heading is 90 deg (Math/ROS).
    // In Canvas: Math.atan2(-1, 0) = -90 deg.
    // So we likely need to Negate rotation? 
    // Let's try `ctx.rotate(-ac.position.r)`.
    
    const handleClick = (e: React.MouseEvent) => {
        if (!onAircraftClick || !canvasRef.current || !meta) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        // Find clicked aircraft (Simple radius check in Pixel Space)
        // Since we don't store pixel pos, re-calculate or approximate.
        // Better: Iterate list again check distance.
        
        for (const ac of aircraftList) {
             const pixel = worldToPixel(ac.position, meta, mapHeight);
             // Distance squared
             const distSq = (mouseX - pixel.x) ** 2 + (mouseY - pixel.y) ** 2;
             if (distSq < 400) { // 20px radius
                 onAircraftClick(ac);
                 return;
             }
        }
    };

    useEffect(() => {
        // ... Render Logic ...
        if (!meta || mapHeight === 0 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        aircraftList.forEach(ac => {
            const pixel = worldToPixel(ac.position, meta, mapHeight);
            
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // Correction: World +Y is Up. Canvas +Y is Down.
            // Angle increases CCW in World. Angle increases CW in Canvas (if Y is Down).
            // So we need to Negate the angle.
            // Also, if 0 = East in World (Right), and 0 = Right in Canvas, valid.
            // If 0 = North in World (Up), then we need offset.
            // Let's try Negating first because of Y-flip.
            ctx.rotate(-ac.position.r); 

            // Draw Body
            // ... (Same drawing)
            const color = STATUS_COLORS[ac.status] || '#FFFFFF';
            ctx.fillStyle = color;
            // ...
            
            ctx.beginPath();
            // Larger Triangle: 
            ctx.moveTo(30, 0);   // Nose (was 10)
            ctx.lineTo(-20, 16); // Left Wing (was -8, 7)
            ctx.lineTo(-10, 0);  // Tail Indent (was -4)
            ctx.lineTo(-20, -16);// Right Wing (was -8, -7)
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
            
            // Label
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            ctx.fillStyle = 'white';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ac.callsign, 0, -15);
            ctx.restore();
        });

    }, [aircraftList, meta, mapHeight]);

    // ...
    // Note: Add onClick handler to Canvas
    return (
        <canvas 
            ref={canvasRef}
            width={2000}
            height={1500}
            className="absolute inset-0 z-20 cursor-pointer" // Pointer events enabled
            onClick={handleClick}
        />
    );
}


