/**
 * Runway-Based Route Calculator
 * 
 * THIS IS THE CORRECT VERSION that uses:
 * - Departure runway threshold as starting point
 * - Arrival runway threshold as ending point
 * - NOT airport center coordinates
 * 
 * CRITICAL: All flight plans must start from a runway threshold,
 * not from airport center coordinates.
 */

import { CSVAirport } from '@/services/airports/airportParser';
import { SelectedRunway } from '@/types/runway';
import { Coordinate } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface RouteWaypoint {
  id: string;
  name: string;
  type: 'THRESHOLD' | 'DEPARTURE' | 'SID' | 'ENROUTE' | 'STAR' | 'APPROACH' | 'THRESHOLD_ARR' | 'ARRIVAL';
  position: Coordinate;
  altitude: number;          // Target altitude (feet)
  speed: number;             // Target speed (knots IAS)
  distanceFromPrev: number;  // Distance from previous waypoint (nm)
  cumulativeDistance: number; // Total distance from departure (nm)
  timeFromPrev: number;      // Time from previous waypoint (minutes)
  cumulativeTime: number;    // Total time from departure (minutes)
  heading: number;           // Heading to this waypoint (degrees)
}

export interface FlightRoute {
  // Airports
  departureAirport: CSVAirport;
  arrivalAirport: CSVAirport;
  
  // Runways - CRITICAL
  departureRunway: SelectedRunway;
  arrivalRunway: SelectedRunway;
  
  // Route data
  waypoints: RouteWaypoint[];
  totalDistance: number;     // nm
  totalTime: number;         // minutes
  cruiseAltitude: number;    // feet
  
  // GeoJSON for map display
  geoJson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: {
        type: 'LineString';
        coordinates: [number, number][];
      };
      properties: {
        name: string;
        type: string;
        phase: string;
      };
    }>;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EARTH_RADIUS_NM = 3440.065;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
// FT_TO_NM constant available if needed: 1 / 6076.12

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate distance between two coordinates in nautical miles
 */
export function calculateDistanceNm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δφ = (lat2 - lat1) * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate bearing between two coordinates
 */
export function calculateBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let bearing = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearing + 360) % 360;
}

/**
 * Calculate intermediate point on great circle
 */
export function interpolateGreatCircle(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  fraction: number
): Coordinate {
  const φ1 = lat1 * DEG_TO_RAD;
  const λ1 = lon1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const λ2 = lon2 * DEG_TO_RAD;

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((φ2 - φ1) / 2), 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.pow(Math.sin((λ2 - λ1) / 2), 2)
  ));

  if (d === 0) {
    return { lat: lat1, lon: lon1 };
  }

  const A = Math.sin((1 - fraction) * d) / Math.sin(d);
  const B = Math.sin(fraction * d) / Math.sin(d);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG,
    lon: Math.atan2(y, x) * RAD_TO_DEG,
  };
}

/**
 * Calculate destination point from start, bearing, and distance
 */
export function destinationPoint(
  lat: number, lon: number,
  distanceNm: number, bearing: number
): Coordinate {
  const φ1 = lat * DEG_TO_RAD;
  const λ1 = lon * DEG_TO_RAD;
  const θ = bearing * DEG_TO_RAD;
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
// MAIN ROUTE GENERATOR
// ============================================================================

/**
 * Generate a complete flight route
 * 
 * CRITICAL: This function REQUIRES runway selections.
 * Aircraft will depart FROM the departure runway threshold
 * and arrive AT the arrival runway threshold.
 */
export function generateFlightRouteWithRunways(
  departureAirport: CSVAirport,
  arrivalAirport: CSVAirport,
  departureRunway: SelectedRunway,
  arrivalRunway: SelectedRunway,
  cruiseAltitude: number = 35000,
  cruiseSpeed: number = 450
): FlightRoute {
  const waypoints: RouteWaypoint[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;

  // Get threshold positions - THIS IS THE KEY FIX
  const depThreshold = departureRunway.end.threshold;
  const arrThreshold = arrivalRunway.end.threshold;
  const depHeading = departureRunway.end.heading;
  const arrHeading = (arrivalRunway.end.heading + 180) % 360; // Reciprocal for landing

  // Calculate total great circle distance between thresholds
  const totalDistance = calculateDistanceNm(
    depThreshold.lat, depThreshold.lon,
    arrThreshold.lat, arrThreshold.lon
  );

  // ========================================
  // 1. DEPARTURE THRESHOLD (Start Point)
  // ========================================
  waypoints.push({
    id: 'THR_DEP',
    name: `RWY ${departureRunway.designator}`,
    type: 'THRESHOLD',
    position: { ...depThreshold },
    altitude: departureRunway.end.elevation,
    speed: 0, // Stationary at threshold
    distanceFromPrev: 0,
    cumulativeDistance: 0,
    timeFromPrev: 0,
    cumulativeTime: 0,
    heading: depHeading,
  });

  // ========================================
  // 2. INITIAL CLIMB WAYPOINT
  // After rotation, climb straight out on runway heading
  // ========================================
  const climbOutDistance = 5; // 5nm straight out
  const climbOutPoint = destinationPoint(
    depThreshold.lat, depThreshold.lon,
    climbOutDistance, depHeading
  );
  
  const climbOutTime = (climbOutDistance / 180) * 60; // ~180 kts during initial climb
  cumulativeDistance = climbOutDistance;
  cumulativeTime = climbOutTime;

  waypoints.push({
    id: 'DEP01',
    name: `${departureAirport.icao}DEP`,
    type: 'DEPARTURE',
    position: climbOutPoint,
    altitude: 3000,
    speed: 180,
    distanceFromPrev: climbOutDistance,
    cumulativeDistance,
    timeFromPrev: climbOutTime,
    cumulativeTime,
    heading: depHeading,
  });

  // ========================================
  // 3. SID EXIT POINT
  // Turn towards destination
  // ========================================
  const sidDistance = 15; // 15nm from threshold
  const bearingToArrival = calculateBearing(
    depThreshold.lat, depThreshold.lon,
    arrThreshold.lat, arrThreshold.lon
  );
  
  // Gradual turn - interpolate heading
  const sidTurnHeading = depHeading + (bearingToArrival - depHeading) * 0.5;
  const sidPoint = destinationPoint(
    depThreshold.lat, depThreshold.lon,
    sidDistance, (depHeading + sidTurnHeading) / 2
  );

  const sidSegmentDist = calculateDistanceNm(
    waypoints[waypoints.length - 1].position.lat,
    waypoints[waypoints.length - 1].position.lon,
    sidPoint.lat, sidPoint.lon
  );
  const sidTime = (sidSegmentDist / 250) * 60;
  cumulativeDistance += sidSegmentDist;
  cumulativeTime += sidTime;

  waypoints.push({
    id: 'SID01',
    name: `${departureAirport.icao}SID`,
    type: 'SID',
    position: sidPoint,
    altitude: Math.min(10000, cruiseAltitude * 0.3),
    speed: 250, // Below FL100 speed limit
    distanceFromPrev: sidSegmentDist,
    cumulativeDistance,
    timeFromPrev: sidTime,
    cumulativeTime,
    heading: bearingToArrival,
  });

  // ========================================
  // 4. ENROUTE WAYPOINTS (Great Circle)
  // ========================================
  const enrouteStartDist = sidDistance;
  const starEntryDist = 20; // STAR begins 20nm before arrival
  const enrouteEndDist = totalDistance - starEntryDist;
  const enrouteLength = enrouteEndDist - enrouteStartDist;

  // Calculate TOC and TOD
  const tocDist = enrouteStartDist + (cruiseAltitude - 10000) / 300; // 300ft/nm climb
  const todDist = totalDistance - starEntryDist - (cruiseAltitude - 10000) / 300;

  // Place waypoints every 100nm (max 15 waypoints)
  const numEnrouteWaypoints = Math.min(15, Math.max(3, Math.ceil(enrouteLength / 100)));
  
  for (let i = 0; i < numEnrouteWaypoints; i++) {
    const fraction = (i + 1) / (numEnrouteWaypoints + 1);
    const waypointDist = enrouteStartDist + enrouteLength * fraction;
    const gcFraction = waypointDist / totalDistance;

    const position = interpolateGreatCircle(
      depThreshold.lat, depThreshold.lon,
      arrThreshold.lat, arrThreshold.lon,
      gcFraction
    );

    // Determine altitude based on position
    let altitude: number;
    if (waypointDist < tocDist) {
      // Still climbing
      const climbProgress = (waypointDist - enrouteStartDist) / (tocDist - enrouteStartDist);
      altitude = 10000 + (cruiseAltitude - 10000) * Math.min(1, climbProgress);
    } else if (waypointDist > todDist) {
      // Descending
      const descentProgress = (waypointDist - todDist) / (totalDistance - starEntryDist - todDist);
      altitude = cruiseAltitude - (cruiseAltitude - 10000) * Math.min(1, descentProgress);
    } else {
      // Cruise
      altitude = cruiseAltitude;
    }

    const prevWp = waypoints[waypoints.length - 1];
    const segmentDist = calculateDistanceNm(
      prevWp.position.lat, prevWp.position.lon,
      position.lat, position.lon
    );

    const speed = altitude > 10000 ? cruiseSpeed : 250;
    const segmentTime = (segmentDist / speed) * 60;

    cumulativeDistance += segmentDist;
    cumulativeTime += segmentTime;

    const heading = calculateBearing(
      prevWp.position.lat, prevWp.position.lon,
      position.lat, position.lon
    );

    waypoints.push({
      id: `ENR${String(i + 1).padStart(2, '0')}`,
      name: generateWaypointName(i),
      type: 'ENROUTE',
      position,
      altitude: Math.round(altitude / 100) * 100,
      speed,
      distanceFromPrev: Math.round(segmentDist * 10) / 10,
      cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
      timeFromPrev: Math.round(segmentTime * 10) / 10,
      cumulativeTime: Math.round(cumulativeTime * 10) / 10,
      heading: Math.round(heading),
    });
  }

  // ========================================
  // 5. STAR ENTRY POINT
  // ========================================
  const starFraction = (totalDistance - starEntryDist) / totalDistance;
  const starPoint = interpolateGreatCircle(
    depThreshold.lat, depThreshold.lon,
    arrThreshold.lat, arrThreshold.lon,
    starFraction
  );

  const prevWpStar = waypoints[waypoints.length - 1];
  const toStarDist = calculateDistanceNm(
    prevWpStar.position.lat, prevWpStar.position.lon,
    starPoint.lat, starPoint.lon
  );
  const starTime = (toStarDist / 280) * 60; // Descending speed
  cumulativeDistance += toStarDist;
  cumulativeTime += starTime;

  const starHeading = calculateBearing(
    prevWpStar.position.lat, prevWpStar.position.lon,
    starPoint.lat, starPoint.lon
  );

  waypoints.push({
    id: 'STAR01',
    name: `${arrivalAirport.icao}ARR`,
    type: 'STAR',
    position: starPoint,
    altitude: 10000,
    speed: 250,
    distanceFromPrev: Math.round(toStarDist * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(starTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: Math.round(starHeading),
  });

  // ========================================
  // 6. APPROACH WAYPOINT (Final Approach Fix)
  // ========================================
  const fafDistance = 8; // 8nm final
  const fafPoint = destinationPoint(
    arrThreshold.lat, arrThreshold.lon,
    fafDistance, arrHeading
  );

  const prevWpFaf = waypoints[waypoints.length - 1];
  const toFafDist = calculateDistanceNm(
    prevWpFaf.position.lat, prevWpFaf.position.lon,
    fafPoint.lat, fafPoint.lon
  );
  const fafTime = (toFafDist / 180) * 60;
  cumulativeDistance += toFafDist;
  cumulativeTime += fafTime;

  const fafHeading = calculateBearing(
    prevWpFaf.position.lat, prevWpFaf.position.lon,
    fafPoint.lat, fafPoint.lon
  );

  waypoints.push({
    id: 'APP01',
    name: 'FAF',
    type: 'APPROACH',
    position: fafPoint,
    altitude: 2500,
    speed: 160,
    distanceFromPrev: Math.round(toFafDist * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(fafTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: Math.round(fafHeading),
  });

  // ========================================
  // 7. ARRIVAL THRESHOLD
  // ========================================
  const toThrDist = fafDistance;
  const thrTime = (toThrDist / 140) * 60; // Final approach speed
  cumulativeDistance += toThrDist;
  cumulativeTime += thrTime;

  waypoints.push({
    id: 'THR_ARR',
    name: `RWY ${arrivalRunway.designator}`,
    type: 'THRESHOLD_ARR',
    position: { ...arrThreshold },
    altitude: arrivalRunway.end.elevation,
    speed: 140,
    distanceFromPrev: Math.round(toThrDist * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(thrTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: (arrivalRunway.end.heading + 180) % 360, // Landing heading is reciprocal
  });

  // ========================================
  // BUILD GEOJSON
  // ========================================
  const geoJson = buildRouteGeoJSON(waypoints, departureAirport, arrivalAirport);

  return {
    departureAirport,
    arrivalAirport,
    departureRunway,
    arrivalRunway,
    waypoints,
    totalDistance: Math.round(cumulativeDistance * 10) / 10,
    totalTime: Math.round(cumulativeTime),
    cruiseAltitude,
    geoJson,
  };
}

/**
 * Build GeoJSON from waypoints
 */
function buildRouteGeoJSON(
  waypoints: RouteWaypoint[],
  departure: CSVAirport,
  arrival: CSVAirport
) {
  const features = [];
  
  // Create overall route line
  const coordinates: [number, number][] = waypoints.map(wp => [wp.position.lon, wp.position.lat]);
  
  features.push({
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
    properties: {
      name: `${departure.icao}-${arrival.icao}`,
      type: 'route',
      phase: 'all',
    },
  });

  // Create segments by phase
  let currentPhase = waypoints[0].type;
  let segmentStart = 0;

  for (let i = 1; i <= waypoints.length; i++) {
    const wp = waypoints[i];

    if (!wp || wp.type !== currentPhase) {
      // End current segment
      const segmentWaypoints = waypoints.slice(segmentStart, i);
      const segmentCoords: [number, number][] = segmentWaypoints.map(
        w => [w.position.lon, w.position.lat]
      );

      if (segmentCoords.length > 1) {
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: segmentCoords,
          },
          properties: {
            name: `${currentPhase} segment`,
            type: 'segment',
            phase: currentPhase,
          },
        });
      }

      if (wp) {
        currentPhase = wp.type;
        segmentStart = i;
      }
    }
  }

  return {
    type: 'FeatureCollection' as const,
    features,
  };
}

/**
 * Generate 5-letter waypoint name
 */
function generateWaypointName(index: number): string {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  
  const seed = (index * 7 + 3) % 100;
  
  let name = '';
  name += consonants[seed % consonants.length];
  name += vowels[(seed * 2) % vowels.length];
  name += consonants[(seed * 3) % consonants.length];
  name += vowels[(seed * 5) % vowels.length];
  name += consonants[(seed * 7) % consonants.length];
  
  return name;
}

// ============================================================================
// ROUTE INTERPOLATION FOR ANIMATION
// ============================================================================

/**
 * Get position along route at given progress (0-1)
 * 
 * IMPORTANT: This interpolates between actual waypoint positions,
 * starting from the runway threshold.
 */
export function getPositionOnRoute(
  route: FlightRoute,
  progress: number
): {
  position: Coordinate;
  altitude: number;
  heading: number;
  speed: number;
  phase: string;
  distanceFlown: number;
  timeElapsed: number;
} {
  const p = Math.max(0, Math.min(1, progress));
  const targetDistance = p * route.totalDistance;

  // Find current segment
  let currentIdx = 0;
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    if (route.waypoints[i + 1].cumulativeDistance >= targetDistance) {
      currentIdx = i;
      break;
    }
    currentIdx = i;
  }

  const currentWp = route.waypoints[currentIdx];
  const nextWp = route.waypoints[currentIdx + 1];

  if (!nextWp) {
    // At destination
    return {
      position: currentWp.position,
      altitude: currentWp.altitude,
      heading: currentWp.heading,
      speed: currentWp.speed,
      phase: currentWp.type,
      distanceFlown: route.totalDistance,
      timeElapsed: route.totalTime,
    };
  }

  // Calculate position within segment
  const segmentStart = currentWp.cumulativeDistance;
  const segmentEnd = nextWp.cumulativeDistance;
  const segmentLength = segmentEnd - segmentStart;
  const progressInSegment = segmentLength > 0
    ? (targetDistance - segmentStart) / segmentLength
    : 0;

  // Interpolate position
  const position = interpolateGreatCircle(
    currentWp.position.lat, currentWp.position.lon,
    nextWp.position.lat, nextWp.position.lon,
    progressInSegment
  );

  // Interpolate altitude
  const altitude = currentWp.altitude + 
    (nextWp.altitude - currentWp.altitude) * progressInSegment;

  // Interpolate speed
  const speed = currentWp.speed + 
    (nextWp.speed - currentWp.speed) * progressInSegment;

  // Calculate heading
  const heading = calculateBearing(
    position.lat, position.lon,
    nextWp.position.lat, nextWp.position.lon
  );

  // Interpolate time
  const segmentStartTime = currentWp.cumulativeTime;
  const segmentEndTime = nextWp.cumulativeTime;
  const timeInSegment = (segmentEndTime - segmentStartTime) * progressInSegment;
  const timeElapsed = segmentStartTime + timeInSegment;

  return {
    position,
    altitude: Math.round(altitude),
    heading: Math.round(heading),
    speed: Math.round(speed),
    phase: currentWp.type,
    distanceFlown: Math.round(targetDistance * 10) / 10,
    timeElapsed: Math.round(timeElapsed),
  };
}

// Functions already exported inline with 'export function' syntax
// No additional exports needed
