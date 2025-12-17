/**
 * Aviation Calculation Utilities
 * 
 * Core aviation mathematics using real formulas:
 * - Great circle distance (Haversine and Vincenty)
 * - True/Magnetic bearing
 * - Wind correction angle
 * - Ground speed calculation
 * - Time/fuel calculations
 * 
 * All calculations use proper units:
 * - Distances in nautical miles
 * - Speeds in knots
 * - Altitudes in feet
 * - Angles in degrees
 */

import * as turf from '@turf/turf';
import { Coordinate, Wind, Aircraft, ProcedureWaypoint } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Kilometers to nautical miles conversion */
const KM_TO_NM = 0.539957;

/** Nautical miles to kilometers conversion */
const NM_TO_KM = 1.852;

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate great circle distance between two points using Haversine formula
 * @returns Distance in nautical miles
 */
export function calculateDistance(from: Coordinate, to: Coordinate): number {
  const point1 = turf.point([from.lon, from.lat]);
  const point2 = turf.point([to.lon, to.lat]);
  
  // Turf returns kilometers by default
  const distanceKm = turf.distance(point1, point2, { units: 'kilometers' });
  
  return distanceKm * KM_TO_NM;
}

/**
 * Calculate distance along a route (array of coordinates)
 * @returns Total distance in nautical miles
 */
export function calculateRouteDistance(waypoints: Coordinate[]): number {
  if (waypoints.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
  }
  
  return totalDistance;
}

/**
 * High-precision distance using Vincenty formula
 * Use for long-distance flights where Haversine may have ~0.3% error
 */
export function calculateDistanceVincenty(from: Coordinate, to: Coordinate): number {
  // Vincenty's formulae (simplified for spheroid)
  const a = 6378137; // semi-major axis (meters)
  const f = 1 / 298.257223563; // flattening
  const b = (1 - f) * a; // semi-minor axis
  
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const L = ((to.lon - from.lon) * Math.PI) / 180;
  
  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  
  let lambda = L;
  let lambdaP: number;
  let iterLimit = 100;
  let sinSigma: number = 0;
  let cosSigma: number = 0;
  let sigma: number = 0;
  let sinAlpha: number = 0;
  let cosSqAlpha: number = 0;
  let cos2SigmaM: number = 0;
  let C: number = 0;
  
  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    
    sinSigma = Math.sqrt(
      Math.pow(cosU2 * sinLambda, 2) +
      Math.pow(cosU1 * sinU2 - sinU1 * cosU2 * cosLambda, 2)
    );
    
    if (sinSigma === 0) return 0; // Co-incident points
    
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);
  
  if (iterLimit === 0) {
    // Formula failed to converge, fall back to Haversine
    return calculateDistance(from, to);
  }
  
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  
  const distanceMeters = b * A * (sigma - deltaSigma);
  
  return (distanceMeters / 1000) * KM_TO_NM;
}

// ============================================================================
// BEARING CALCULATIONS
// ============================================================================

/**
 * Calculate initial bearing (forward azimuth) from one point to another
 * @returns Bearing in degrees true (0-360)
 */
export function calculateBearing(from: Coordinate, to: Coordinate): number {
  const point1 = turf.point([from.lon, from.lat]);
  const point2 = turf.point([to.lon, to.lat]);
  
  let bearing = turf.bearing(point1, point2);
  
  // Normalize to 0-360
  if (bearing < 0) {
    bearing += 360;
  }
  
  return bearing;
}

/**
 * Calculate final bearing (backward azimuth + 180)
 * This is the bearing you arrive at the destination with
 */
export function calculateFinalBearing(from: Coordinate, to: Coordinate): number {
  // Reverse the points and add 180
  let bearing = calculateBearing(to, from) + 180;
  
  if (bearing >= 360) {
    bearing -= 360;
  }
  
  return bearing;
}

/**
 * Convert true bearing to magnetic bearing
 * @param trueBearing Bearing in degrees true
 * @param magneticVariation Magnetic variation (positive = East)
 * @returns Magnetic bearing (0-360)
 */
export function trueToMagnetic(trueBearing: number, magneticVariation: number): number {
  let magnetic = trueBearing - magneticVariation;
  
  if (magnetic < 0) magnetic += 360;
  if (magnetic >= 360) magnetic -= 360;
  
  return magnetic;
}

/**
 * Convert magnetic bearing to true bearing
 */
export function magneticToTrue(magneticBearing: number, magneticVariation: number): number {
  let trueBearing = magneticBearing + magneticVariation;
  
  if (trueBearing < 0) trueBearing += 360;
  if (trueBearing >= 360) trueBearing -= 360;
  
  return trueBearing;
}

// ============================================================================
// WIND CALCULATIONS
// ============================================================================

/**
 * Calculate wind correction angle (WCA)
 * The angle the aircraft must crab into the wind to maintain course
 * 
 * @param course True course in degrees
 * @param tas True airspeed in knots
 * @param wind Wind direction (FROM) and speed
 * @returns Wind correction angle in degrees (positive = right, negative = left)
 */
export function calculateWindCorrectionAngle(
  course: number,
  tas: number,
  wind: Wind
): number {
  if (wind.speed === 0 || tas === 0) return 0;
  
  // Wind direction is where the wind is coming FROM
  // We need the wind TO direction for the calculation
  const windTo = (wind.direction + 180) % 360;
  
  // Angle between course and wind
  const windAngle = ((windTo - course + 360) % 360) * (Math.PI / 180);
  
  // Cross-wind component
  const crossWind = wind.speed * Math.sin(windAngle);
  
  // Wind correction angle
  const wcaRad = Math.asin(crossWind / tas);
  const wca = (wcaRad * 180) / Math.PI;
  
  return wca;
}

/**
 * Calculate ground speed given true airspeed and wind
 * 
 * @param course True course in degrees
 * @param tas True airspeed in knots
 * @param wind Wind direction (FROM) and speed
 * @returns Ground speed in knots
 */
export function calculateGroundSpeed(
  course: number,
  tas: number,
  wind: Wind
): number {
  if (wind.speed === 0) return tas;
  
  // Wind direction is where the wind is coming FROM
  const windTo = (wind.direction + 180) % 360;
  
  // Angle between course and wind
  const windAngle = ((windTo - course + 360) % 360) * (Math.PI / 180);
  
  // Head/tail wind component
  const headWind = wind.speed * Math.cos(windAngle);
  
  // Cross-wind component
  const crossWind = wind.speed * Math.sin(windAngle);
  
  // Ground speed using wind triangle
  const gs = Math.sqrt(Math.pow(tas, 2) - Math.pow(crossWind, 2)) + headWind;
  
  return Math.max(0, gs);
}

/**
 * Calculate heading required to maintain course given wind
 * 
 * @param course Desired true course in degrees
 * @param tas True airspeed in knots
 * @param wind Wind direction (FROM) and speed
 * @returns Required heading in degrees true
 */
export function calculateHeading(
  course: number,
  tas: number,
  wind: Wind
): number {
  const wca = calculateWindCorrectionAngle(course, tas, wind);
  let heading = course + wca;
  
  if (heading < 0) heading += 360;
  if (heading >= 360) heading -= 360;
  
  return heading;
}

// ============================================================================
// TIME AND FUEL CALCULATIONS
// ============================================================================

/**
 * Calculate estimated time enroute
 * @param distanceNm Distance in nautical miles
 * @param groundSpeed Ground speed in knots
 * @returns Time in seconds
 */
export function calculateETE(distanceNm: number, groundSpeed: number): number {
  if (groundSpeed <= 0) return Infinity;
  
  const hours = distanceNm / groundSpeed;
  return hours * 3600;
}

/**
 * Calculate fuel required for a leg
 * @param timeSeconds Time in seconds
 * @param fuelFlow Fuel flow rate (units/hour)
 * @returns Fuel required in same units as fuel flow
 */
export function calculateFuelRequired(
  timeSeconds: number,
  fuelFlow: number
): number {
  const hours = timeSeconds / 3600;
  return hours * fuelFlow;
}

/**
 * Calculate total flight time for a route
 */
export function calculateTotalFlightTime(
  waypoints: ProcedureWaypoint[],
  aircraft: Aircraft,
  wind?: Wind
): { totalTime: number; legTimes: number[] } {
  if (waypoints.length < 2) {
    return { totalTime: 0, legTimes: [] };
  }
  
  const legTimes: number[] = [];
  let totalTime = 0;
  
  const tas = aircraft.performance.cruiseSpeed;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i].position;
    const to = waypoints[i + 1].position;
    
    const distance = calculateDistance(from, to);
    const course = calculateBearing(from, to);
    
    const groundSpeed = wind
      ? calculateGroundSpeed(course, tas, wind)
      : tas;
    
    const time = calculateETE(distance, groundSpeed);
    legTimes.push(time);
    totalTime += time;
  }
  
  return { totalTime, legTimes };
}

// ============================================================================
// POSITION CALCULATIONS
// ============================================================================

/**
 * Calculate a point at a given distance and bearing from a starting point
 * @param start Starting coordinate
 * @param distanceNm Distance in nautical miles
 * @param bearing Bearing in degrees true
 * @returns New coordinate
 */
export function calculateDestination(
  start: Coordinate,
  distanceNm: number,
  bearing: number
): Coordinate {
  const point = turf.point([start.lon, start.lat]);
  const distanceKm = distanceNm * NM_TO_KM;
  
  const destination = turf.destination(point, distanceKm, bearing, {
    units: 'kilometers',
  });
  
  return {
    lat: destination.geometry.coordinates[1],
    lon: destination.geometry.coordinates[0],
  };
}

/**
 * Interpolate a position along a great circle path
 * @param from Start coordinate
 * @param to End coordinate
 * @param fraction Progress along the path (0-1)
 * @returns Interpolated coordinate
 */
export function interpolatePosition(
  from: Coordinate,
  to: Coordinate,
  fraction: number
): Coordinate {
  const point1 = turf.point([from.lon, from.lat]);
  const point2 = turf.point([to.lon, to.lat]);
  
  // Create a great circle line
  const line = turf.greatCircle(point1, point2, { npoints: 100 });
  
  // Handle potential MultiLineString from greatCircle
  const lineString = line.geometry.type === 'MultiLineString' 
    ? turf.lineString(line.geometry.coordinates.flat() as [number, number][])
    : line as GeoJSON.Feature<GeoJSON.LineString>;
  
  // Get total length
  const totalLength = turf.length(lineString, { units: 'kilometers' });
  
  // Find point at fraction of distance
  const distanceKm = totalLength * Math.max(0, Math.min(1, fraction));
  const point = turf.along(lineString, distanceKm, { units: 'kilometers' });
  
  return {
    lat: point.geometry.coordinates[1],
    lon: point.geometry.coordinates[0],
  };
}

/**
 * Generate great circle path between two points
 * @param from Start coordinate
 * @param to End coordinate
 * @param numPoints Number of points to generate
 * @returns Array of coordinates along the great circle
 */
export function generateGreatCirclePath(
  from: Coordinate,
  to: Coordinate,
  numPoints: number = 50
): Coordinate[] {
  const point1 = turf.point([from.lon, from.lat]);
  const point2 = turf.point([to.lon, to.lat]);
  
  const line = turf.greatCircle(point1, point2, { npoints: numPoints });
  
  // Handle potential MultiLineString from greatCircle
  const coords = line.geometry.type === 'MultiLineString'
    ? line.geometry.coordinates.flat()
    : line.geometry.coordinates;
  
  return coords.map((coord) => ({ 
    lat: coord[1] as number, 
    lon: coord[0] as number 
  }));
}

// ============================================================================
// ALTITUDE CALCULATIONS
// ============================================================================

/**
 * Calculate true altitude from indicated altitude
 * Accounts for non-standard temperature and pressure
 */
export function calculateTrueAltitude(
  indicatedAlt: number,
  altimeterSetting: number,
  oat: number, // Outside air temperature in Celsius
  stationElevation: number
): number {
  // Standard pressure at sea level
  const standardPressure = 29.92;
  
  // Pressure altitude
  const pressureAlt = indicatedAlt + (standardPressure - altimeterSetting) * 1000;
  
  // ISA temperature at pressure altitude
  const isaTemp = 15 - (pressureAlt / 1000) * 2;
  
  // Temperature correction
  const tempCorrection = ((pressureAlt - stationElevation) / 1000) * 
    (oat - isaTemp) * 4;
  
  return pressureAlt + tempCorrection;
}

/**
 * Calculate density altitude
 * Important for aircraft performance calculations
 */
export function calculateDensityAltitude(
  pressureAlt: number,
  oat: number // Outside air temperature in Celsius
): number {
  // ISA temperature at pressure altitude
  const isaTemp = 15 - (pressureAlt / 1000) * 2;
  
  // Density altitude = PA + (120 × (OAT - ISA temp))
  return pressureAlt + 120 * (oat - isaTemp);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Format bearing for display (e.g., "045°")
 */
export function formatBearing(bearing: number): string {
  return `${Math.round(bearing).toString().padStart(3, '0')}°`;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceNm: number): string {
  if (distanceNm < 1) {
    return `${(distanceNm * 10).toFixed(1)} nm`;
  }
  return `${distanceNm.toFixed(1)} nm`;
}

/**
 * Format time for display (HH:MM:SS or MM:SS)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format speed for display
 */
export function formatSpeed(knots: number): string {
  return `${Math.round(knots)} kt`;
}

/**
 * Format altitude for display
 */
export function formatAltitude(feet: number): string {
  if (feet >= 18000) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${feet.toLocaleString()} ft`;
}
