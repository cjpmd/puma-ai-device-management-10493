/**
 * GPS to Pitch Coordinate Conversion Service
 * Converts GPS coordinates to relative pitch positions using bilinear interpolation
 */

export interface PitchCalibration {
  id: string;
  name: string;
  corners: {
    nw: { lat: number; lon: number };
    ne: { lat: number; lon: number };
    sw: { lat: number; lon: number };
    se: { lat: number; lon: number };
  };
  dimensions: {
    length: number; // meters
    width: number; // meters
  };
  is_active: boolean;
}

/**
 * Haversine distance formula - calculates distance between two GPS points
 */
export const haversineDistance = (
  point1: { lat: number; lon: number },
  point2: { lat: number; lon: number }
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lon - point1.lon) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Convert GPS coordinates to pitch coordinates using bilinear interpolation
 */
export const gpsToPitchCoordinates = (
  gpsLat: number,
  gpsLon: number,
  calibration: PitchCalibration
): { x: number; y: number } => {
  const { corners, dimensions } = calibration;

  // Calculate normalized position (0-1) using bilinear interpolation
  // u represents position along the length (north-south)
  // v represents position along the width (east-west)

  // Simplified approach: use distances from corners
  const distNW = haversineDistance({ lat: gpsLat, lon: gpsLon }, corners.nw);
  const distNE = haversineDistance({ lat: gpsLat, lon: gpsLon }, corners.ne);
  const distSW = haversineDistance({ lat: gpsLat, lon: gpsLon }, corners.sw);
  const distSE = haversineDistance({ lat: gpsLat, lon: gpsLon }, corners.se);

  // Calculate weights based on inverse distance
  const weightNW = 1 / (distNW + 0.001);
  const weightNE = 1 / (distNE + 0.001);
  const weightSW = 1 / (distSW + 0.001);
  const weightSE = 1 / (distSE + 0.001);

  const totalWeight = weightNW + weightNE + weightSW + weightSE;

  // North-south position (0 = north, 1 = south)
  const u = (weightSW + weightSE) / totalWeight;
  
  // East-west position (0 = west, 1 = east)
  const v = (weightNE + weightSE) / totalWeight;

  return {
    x: u * dimensions.length,
    y: v * dimensions.width,
  };
};

/**
 * Calculate total distance from an array of GPS points
 */
export const calculateDistance = (
  points: Array<{ lat: number; lon: number }>
): number => {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += haversineDistance(points[i - 1], points[i]);
  }
  return totalDistance; // in meters
};

/**
 * Determine which third of the pitch a position is in
 */
export const getPitchThird = (
  xPosition: number,
  pitchLength: number
): 'defensive' | 'middle' | 'attacking' => {
  const third = xPosition / (pitchLength / 3);
  if (third < 1) return 'defensive';
  if (third < 2) return 'middle';
  return 'attacking';
};

/**
 * Calculate average speed from GPS points
 */
export const calculateAverageSpeed = (
  points: Array<{ speed?: number }>
): number => {
  const speeds = points.filter(p => p.speed !== undefined && p.speed !== null).map(p => p.speed!);
  if (speeds.length === 0) return 0;
  return speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
};

/**
 * Find max speed from GPS points
 */
export const findMaxSpeed = (
  points: Array<{ speed?: number }>
): number => {
  const speeds = points.filter(p => p.speed !== undefined && p.speed !== null).map(p => p.speed!);
  if (speeds.length === 0) return 0;
  return Math.max(...speeds);
};

/**
 * Calculate bearing (direction) between two GPS points
 */
export const calculateBearing = (
  point1: { lat: number; lon: number },
  point2: { lat: number; lon: number }
): number => {
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δλ = ((point2.lon - point1.lon) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360; // in degrees
};
