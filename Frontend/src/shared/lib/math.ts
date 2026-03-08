/**
 * Utility functions for mathematical calculations
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates the Euclidean distance between two points
 */
export const calculateEuclideanDistance = (p1: Point, p2: Point): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Applies a Low-Pass Filter to smooth out jittery data
 * alpha: smoothing factor (0 to 1). Lower value = more smoothing.
 */
export const applyLowPassFilter = (
  prev: number,
  current: number,
  alpha: number = 0.3
): number => {
  return prev * (1 - alpha) + current * alpha;
};

/**
 * Converts meters per second to kilometers per hour
 */
export const msToKmh = (ms: number): number => {
  return ms * 3.6;
};
