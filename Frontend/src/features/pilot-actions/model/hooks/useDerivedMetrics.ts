import { useEffect, useRef, useState } from "react";
import { Aircraft } from "@/entities/map/model/types";
import { useGraphStore } from "@/entities/map/model/store";
import { useMissionStore } from "@/entities/mission";
import { calculateEuclideanDistance, applyLowPassFilter } from "@/shared/lib/math";

interface DerivedMetrics {
  calcSpeed: number; // m/s
  distRemain: number | null; // meters
  destination: string;
}

/**
 * Hook to calculate real-time metrics based on aircraft movement and map data.
 * Adheres to FSD Architecture by separating business logic from UI.
 */
export function useDerivedMetrics(aircraft: Aircraft | null): DerivedMetrics {
  const lastPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [calcSpeed, setCalcSpeed] = useState<number>(0);

  const nodes = useGraphStore((state) => state.nodes);
  const activeMissions = useMissionStore((state) => state.activeMissions);

  // 1. Ground Speed Calculation
  useEffect(() => {
    if (!aircraft) {
      lastPosRef.current = null;
      setCalcSpeed(0);
      return;
    }

    const now = Date.now();
    const currentPos = {
      x: aircraft.position.x,
      y: aircraft.position.y,
      time: now,
    };

    if (lastPosRef.current) {
      const dt = (now - lastPosRef.current.time) / 1000; // seconds
      
      // Calculate only if enough time has passed to avoid noise (e.g., > 0.5s)
      if (dt > 0.5) {
        const dist = calculateEuclideanDistance(currentPos, lastPosRef.current);
        const instantSpeed = dist / dt; // m/s

        // Smooth speed using Low-Pass Filter
        setCalcSpeed((prev) => applyLowPassFilter(prev, instantSpeed, 0.3));
        lastPosRef.current = currentPos;
      }
    } else {
      lastPosRef.current = currentPos;
    }
  }, [aircraft]);

  // 2. Distance to Goal Calculation
  const mission = aircraft?.id ? activeMissions[aircraft.id] : null;
  const destNodeId = mission?.destNode;
  const destNode = nodes.find((n) => n.id === destNodeId);

  const distRemain = (aircraft && destNode)
    ? calculateEuclideanDistance(aircraft.position, destNode)
    : null;

  return {
    calcSpeed,
    distRemain,
    destination: destNodeId || "STANDBY",
  };
}
