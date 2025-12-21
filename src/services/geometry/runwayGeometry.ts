/**
 * Runway Geometry Service
 * 
 * OWNERSHIP: This file owns ALL runway geometry calculations.
 * - Unit vector calculation
 * - Heading from coordinates
 * - 1D → 2D position conversion
 * - Distance calculations
 * 
 * NO simulation logic here. NO validation. NO rendering.
 */

import { RunwayUnitVector } from '@/types/simulation';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_NM = 3440.065;
const NM_TO_FT = 6076.12;
const FT_TO_NM = 1 / NM_TO_FT;
const KTS_TO_FPS = 1.68781;  // Knots to feet per second

// ============================================================================
// EXPORTS FOR CONSTANTS (used by phase logic)
// ============================================================================

export { FT_TO_NM, NM_TO_FT, KTS_TO_FPS };

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula.
 * 
 * @param lat1 - Start latitude (degrees)
 * @param lon1 - Start longitude (degrees)
 * @param lat2 - End latitude (degrees)
 * @param lon2 - End longitude (degrees)
 * @returns Distance in nautical miles
 */
export function calculateDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δφ = (lat2 - lat1) * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate distance in feet.
 */
export function calculateDistanceFt(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceNm(lat1, lon1, lat2, lon2) * NM_TO_FT;
}

// ============================================================================
// HEADING CALCULATION
// ============================================================================

/**
 * Calculate true heading from point 1 to point 2.
 * 
 * Uses initial bearing formula for great circle navigation.
 * 
 * @param lat1 - Start latitude (degrees)
 * @param lon1 - Start longitude (degrees)
 * @param lat2 - End latitude (degrees)
 * @param lon2 - End longitude (degrees)
 * @returns Heading in degrees (0-360)
 */
export function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x) * RAD_TO_DEG;
  return (θ + 360) % 360;
}

// ============================================================================
// RUNWAY UNIT VECTOR
// ============================================================================

/**
 * Calculate the unit vector along a runway in degrees-per-nautical-mile.
 * 
 * This converts the runway from threshold coordinates to a normalized
 * direction vector that can be used for 1D → 2D position calculation.
 * 
 * @param thresholdLat - Departure threshold latitude
 * @param thresholdLon - Departure threshold longitude
 * @param oppositeThresholdLat - Opposite end latitude
 * @param oppositeThresholdLon - Opposite end longitude
 * @returns Unit vector { dLatPerNm, dLonPerNm }
 */
export function calculateRunwayUnitVector(
  thresholdLat: number,
  thresholdLon: number,
  oppositeThresholdLat: number,
  oppositeThresholdLon: number
): RunwayUnitVector {
  // Calculate runway length
  const runwayLengthNm = calculateDistanceNm(
    thresholdLat, thresholdLon,
    oppositeThresholdLat, oppositeThresholdLon
  );
  
  // Avoid division by zero
  if (runwayLengthNm < 0.001) {
    return { dLatPerNm: 0, dLonPerNm: 0 };
  }
  
  // Delta in degrees
  const dLat = oppositeThresholdLat - thresholdLat;
  const dLon = oppositeThresholdLon - thresholdLon;
  
  return {
    dLatPerNm: dLat / runwayLengthNm,
    dLonPerNm: dLon / runwayLengthNm,
  };
}

// ============================================================================
// 1D → 2D POSITION CONVERSION (CRITICAL FOR TAKEOFF)
// ============================================================================

/**
 * Get 2D position from 1D distance along runway.
 * 
 * THIS IS THE CRITICAL FUNCTION FOR TAKEOFF ROLL.
 * 
 * During ground operations (LINEUP, TAKEOFF_ROLL, V1, ROTATE, LIFTOFF),
 * the aircraft position is computed as:
 * 
 *   position = threshold + (distanceAlongRunway * unitVector)
 * 
 * This ensures perfectly runway-aligned motion with NO interpolation
 * along route waypoints during ground phase.
 * 
 * @param thresholdLat - Departure threshold latitude
 * @param thresholdLon - Departure threshold longitude
 * @param unitVector - Pre-computed unit vector (degrees per nm)
 * @param distanceAlongRunwayFt - Distance from threshold in feet
 * @returns Position { lat, lon }
 */
export function getPositionOnRunway(
  thresholdLat: number,
  thresholdLon: number,
  unitVector: RunwayUnitVector,
  distanceAlongRunwayFt: number
): { lat: number; lon: number } {
  // Convert feet to nautical miles
  const distanceNm = distanceAlongRunwayFt * FT_TO_NM;
  
  // Apply unit vector
  return {
    lat: thresholdLat + (unitVector.dLatPerNm * distanceNm),
    lon: thresholdLon + (unitVector.dLonPerNm * distanceNm),
  };
}

// ============================================================================
// GREAT CIRCLE INTERPOLATION (FOR ENROUTE)
// ============================================================================

/**
 * Interpolate along great circle between two points.
 * 
 * Used for enroute flight (after INITIAL_CLIMB).
 * NOT used during ground operations.
 * 
 * @param lat1 - Start latitude (degrees)
 * @param lon1 - Start longitude (degrees)
 * @param lat2 - End latitude (degrees)
 * @param lon2 - End longitude (degrees)
 * @param fraction - Fraction along path (0 to 1)
 * @returns Interpolated position { lat, lon }
 */
export function interpolateGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): { lat: number; lon: number } {
  // Clamp fraction
  const f = Math.max(0, Math.min(1, fraction));
  
  const φ1 = lat1 * DEG_TO_RAD;
  const λ1 = lon1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const λ2 = lon2 * DEG_TO_RAD;

  // Angular distance
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));

  // Handle zero distance
  if (d < 1e-10) {
    return { lat: lat1, lon: lon1 };
  }

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG,
    lon: Math.atan2(y, x) * RAD_TO_DEG,
  };
}

/**
 * Calculate destination point given start, bearing, and distance.
 * 
 * @param lat - Start latitude (degrees)
 * @param lon - Start longitude (degrees)
 * @param bearingDeg - Bearing in degrees
 * @param distanceNm - Distance in nautical miles
 * @returns Destination { lat, lon }
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceNm: number
): { lat: number; lon: number } {
  const φ1 = lat * DEG_TO_RAD;
  const λ1 = lon * DEG_TO_RAD;
  const θ = bearingDeg * DEG_TO_RAD;
  const δ = distanceNm / EARTH_RADIUS_NM;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    lat: φ2 * RAD_TO_DEG,
    lon: ((λ2 * RAD_TO_DEG) + 540) % 360 - 180,
  };
}

// ============================================================================
// TURN CALCULATIONS
// ============================================================================

/**
 * Calculate heading difference (always -180 to +180).
 */
export function headingDifference(from: number, to: number): number {
  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Standard rate turn: 3 degrees per second.
 * Calculate bank angle for a given speed (simplified).
 */
export function standardRateBankAngle(speedKts: number): number {
  // Bank angle = atan(V² / (g * r)) where r = V / rate
  // For 3°/s turn: bank ≈ atan(0.0027 * V)
  // Simplified: at 200 kts ≈ 25°, at 400 kts ≈ 30°
  return Math.min(30, Math.max(15, speedKts * 0.075));
}
