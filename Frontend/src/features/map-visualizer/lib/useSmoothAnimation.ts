import { useEffect, useRef, useState } from 'react';
import { Aircraft } from '@/entities/map/model/types';

// Interpolation Logic
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// Angle Interpolation (Shortest path)
const lerpAngle = (start: number, end: number, t: number) => {
    const da = (end - start) % (2 * Math.PI);
    const shortestAngle = (2 * da % (2 * Math.PI)) - da;
    return start + (shortestAngle * t);
};

export function useSmoothAnimation(targetAircrafts: Aircraft[], duration: number = 200) {
    const [animatedAircrafts, setAnimatedAircrafts] = useState<Aircraft[]>(targetAircrafts);
    
    // Store previous state to interpolate FROM
    const prevAircraftsRef = useRef<Map<string, Aircraft>>(new Map());
    
    // Animation Frame Reference
    const requestRef = useRef<number>();
    const startTimeRef = useRef<number>();

    useEffect(() => {
        // When targets change, we start a new transition
        // 1. Update previous state map with current animated values (to continue smoothly)
        //    Actually, we should snapshot the *current animated state* as the start point.
        const startStateMap = new Map<string, Aircraft>();
        
        // If it's the first run, or completely new item, start from target.
        // But for existing items, start from where they currently are visually.
        animatedAircrafts.forEach(a => {
            startStateMap.set(a.id, a);
        });

        // 2. Setup Animation
        prevAircraftsRef.current = startStateMap;
        startTimeRef.current = performance.now();
        
        const animate = (time: number) => {
            const startTime = startTimeRef.current || time;
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1.0); // 0.0 -> 1.0

            if (progress < 1.0) {
                const nextFrameAircrafts = targetAircrafts.map(target => {
                    const start = prevAircraftsRef.current.get(target.id);
                    // If no previous state (newly added), jump to target
                    if (!start) return target;

                    // Interpolate
                    return {
                        ...target, // Keep other properties (status, battery, etc) updated
                        position: {
                            x: lerp(start.position.x, target.position.x, progress),
                            y: lerp(start.position.y, target.position.y, progress),
                            // Handle rotation interpolation
                            r: lerpAngle(start.position.r, target.position.r, progress)
                        }
                    };
                });

                setAnimatedAircrafts(nextFrameAircrafts);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                // Animation Finished - Snap to exact target
                setAnimatedAircrafts(targetAircrafts);
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetAircrafts]); // Only trigger when input data changes

    return animatedAircrafts;
}
