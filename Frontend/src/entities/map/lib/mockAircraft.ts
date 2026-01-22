import { useEffect, useState } from "react";
import { Aircraft } from "../model/types";

// Initial Mock State (Aligned with MQTT v1.1)
const INITIAL_AIRCRAFT: Aircraft[] = [
    {
        id: "TC01",
        callsign: "TC01",
        type: "TUG",
        position: { x: 50, y: 37.5, r: 0 }, 
        status: "MOVING",
        battery: 85,
        speed: 1.2,
        currentMission: "DOCKING_A",
        isLoaded: false
    },
    {
        id: "TC02",
        callsign: "TC02",
        type: "TUG",
        position: { x: 30, y: 15, r: Math.PI / 2 }, 
        status: "DOCKING",
        battery: 45,
        speed: 0,
        currentMission: null,
        isLoaded: true
    }
];

const moveTowards = (current: number, target: number, speed: number) => {
    if (Math.abs(target - current) < speed) return target;
    return current + Math.sign(target - current) * speed;
};

export function useMockAircraftMqtt() {
    const [aircraft, setAircraft] = useState<Aircraft[]>(INITIAL_AIRCRAFT);

    useEffect(() => {
        // Simulating 10Hz Telemetry Updates
        const interval = setInterval(() => {
            setAircraft(prev => prev.map(ac => {
                if (ac.id === 'TC01') {
                    // TC01: Patrols back and forth on Y axis
                    const targetY = 60;
                    const newY = moveTowards(ac.position.y, targetY, 0.05); // 0.05m per tick (10Hz)
                    
                    // Simple reset logic for demo
                    if (newY >= 60) return { ...ac, position: { ...ac.position, y: 37.5 } };
                    
                    return {
                        ...ac,
                        position: { ...ac.position, y: newY },
                        speed: 0.5 // 0.5 m/s
                    };
                }
                
                if (ac.id === 'TC02') {
                     // TC02: Charging/Docking (Static battery update)
                     return {
                         ...ac,
                         battery: Math.min(100, ac.battery + 0.02)
                     }
                }

                return ac;
            }));

        }, 100); // 10Hz (100ms)

        return () => clearInterval(interval);
    }, []);

    return aircraft;
}
