/**
 * Flight Route Calculator
 * 
 * Generates realistic aviation routes including:
 * - Great circle routing
 * - SID exit points
 * - Enroute waypoints
 * - STAR entry points
 * - Approach paths
 * 
 * Routes are NOT straight lines - they follow aviation practices.
 */

import { CSVAirport } from '@/services/airports/airportParser';
import { calculateDistanceNm, calculateBearing } from '@/services/dispatcher/dispatcherService';

// ============================================================================
// TYPES
// ============================================================================

export interface RouteWaypoint {
  id: string;
  name: string;
  type: 'DEPARTURE' | 'SID' | 'ENROUTE' | 'STAR' | 'APPROACH' | 'ARRIVAL';
  latitude: number;
  longitude: number;
  altitude: number;          // Target altitude (feet)
  speed: number;             // Target speed (knots IAS)
  distanceFromPrev: number;  // Distance from previous waypoint (nm)
  cumulativeDistance: number; // Total distance from departure (nm)
  timeFromPrev: number;      // Time from previous waypoint (minutes)
  cumulativeTime: number;    // Total time from departure (minutes)
  heading: number;           // Heading to this waypoint (degrees)
}

export interface FlightRoute {
  departure: CSVAirport;
  arrival: CSVAirport;
  waypoints: RouteWaypoint[];
  totalDistance: number;     // nm
  totalTime: number;         // minutes
  cruiseAltitude: number;    // feet
  initialClimbAltitude: number;
  
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

// Waypoint intervals
const ENROUTE_WAYPOINT_INTERVAL_NM = 100; // Place waypoint every 100nm
const MIN_WAYPOINTS = 3;
const MAX_WAYPOINTS = 20;

// ============================================================================
// GREAT CIRCLE CALCULATIONS
// ============================================================================

/**
 * Calculate intermediate point on great circle
 * @param lat1 - Start latitude
 * @param lon1 - Start longitude
 * @param lat2 - End latitude
 * @param lon2 - End longitude
 * @param fraction - Fraction along the route (0 to 1)
 */
export function interpolateGreatCircle(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  fraction: number
): { latitude: number; longitude: number } {
  const φ1 = lat1 * DEG_TO_RAD;
  const λ1 = lon1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const λ2 = lon2 * DEG_TO_RAD;

  // Angular distance
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((φ2 - φ1) / 2), 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.pow(Math.sin((λ2 - λ1) / 2), 2)
  ));

  if (d === 0) {
    return { latitude: lat1, longitude: lon1 };
  }

  const A = Math.sin((1 - fraction) * d) / Math.sin(d);
  const B = Math.sin(fraction * d) / Math.sin(d);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const latitude = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG;
  const longitude = Math.atan2(y, x) * RAD_TO_DEG;

  return { latitude, longitude };
}

/**
 * Calculate point at distance and bearing from start
 */
function destinationPoint(
  lat: number, lon: number,
  distanceNm: number, bearing: number
): { latitude: number; longitude: number } {
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
    latitude: φ2 * RAD_TO_DEG,
    longitude: ((λ2 * RAD_TO_DEG) + 540) % 360 - 180, // Normalize to -180 to 180
  };
}

// ============================================================================
// ROUTE GENERATION
// ============================================================================

/**
 * Generate a complete flight route
 */
export function generateFlightRoute(
  departure: CSVAirport,
  arrival: CSVAirport,
  cruiseAltitude: number = 35000,
  cruiseSpeed: number = 450
): FlightRoute {
  const waypoints: RouteWaypoint[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;

  const totalDistance = calculateDistanceNm(
    departure.latitude, departure.longitude,
    arrival.latitude, arrival.longitude
  );

  // Initial bearing
  const initialBearing = calculateBearing(
    departure.latitude, departure.longitude,
    arrival.latitude, arrival.longitude
  );

  // ========================================
  // 1. DEPARTURE WAYPOINT
  // ========================================
  waypoints.push({
    id: 'DEP',
    name: departure.icao,
    type: 'DEPARTURE',
    latitude: departure.latitude,
    longitude: departure.longitude,
    altitude: departure.elevation,
    speed: 0,
    distanceFromPrev: 0,
    cumulativeDistance: 0,
    timeFromPrev: 0,
    cumulativeTime: 0,
    heading: initialBearing,
  });

  // ========================================
  // 2. SID EXIT POINT
  // ========================================
  // Typically 10-20nm from departure
  const sidDistance = 15;
  const sidPoint = destinationPoint(
    departure.latitude, departure.longitude,
    sidDistance, initialBearing
  );

  // Calculate climb profile
  const climbAltitude = Math.min(10000, cruiseAltitude * 0.3);
  const timeToSid = (sidDistance / 250) * 60; // Assume 250kts average
  cumulativeDistance = sidDistance;
  cumulativeTime = timeToSid;

  waypoints.push({
    id: 'SID01',
    name: `${departure.icao}SID`,
    type: 'SID',
    latitude: sidPoint.latitude,
    longitude: sidPoint.longitude,
    altitude: climbAltitude,
    speed: 250, // Below 10,000ft speed limit
    distanceFromPrev: sidDistance,
    cumulativeDistance,
    timeFromPrev: timeToSid,
    cumulativeTime,
    heading: initialBearing,
  });

  // ========================================
  // 3. ENROUTE WAYPOINTS (Great Circle)
  // ========================================
  const enrouteStart = sidDistance;
  const enrouteEnd = totalDistance - 20; // Leave 20nm for STAR
  const enrouteDistance = enrouteEnd - enrouteStart;

  // Calculate number of waypoints
  let numWaypoints = Math.ceil(enrouteDistance / ENROUTE_WAYPOINT_INTERVAL_NM);
  numWaypoints = Math.max(MIN_WAYPOINTS - 2, Math.min(MAX_WAYPOINTS - 4, numWaypoints));

  // Top of climb (reach cruise altitude)
  const climbDistance = (cruiseAltitude - climbAltitude) / 300; // 300ft/nm climb gradient
  const tocDistance = Math.min(sidDistance + climbDistance, enrouteEnd * 0.3);

  // Top of descent
  const descentDistance = (cruiseAltitude - arrival.elevation) / 300; // 300ft/nm descent
  const todDistance = totalDistance - descentDistance - 10;

  for (let i = 0; i < numWaypoints; i++) {
    const fraction = (i + 1) / (numWaypoints + 1);
    const distance = enrouteStart + (enrouteDistance * fraction);
    
    // Get great circle position
    const gcFraction = distance / totalDistance;
    const point = interpolateGreatCircle(
      departure.latitude, departure.longitude,
      arrival.latitude, arrival.longitude,
      gcFraction
    );

    // Calculate altitude (climb, cruise, or descent)
    let altitude: number;
    if (distance < tocDistance) {
      // Still climbing
      const climbFraction = (distance - sidDistance) / (tocDistance - sidDistance);
      altitude = climbAltitude + (cruiseAltitude - climbAltitude) * Math.min(1, climbFraction);
    } else if (distance > todDistance) {
      // Descending
      const descentFraction = (distance - todDistance) / (totalDistance - todDistance - 10);
      altitude = cruiseAltitude - (cruiseAltitude - 10000) * Math.min(1, descentFraction);
    } else {
      // Cruise
      altitude = cruiseAltitude;
    }

    // Calculate segment distance
    const prevWaypoint = waypoints[waypoints.length - 1];
    const segmentDistance = calculateDistanceNm(
      prevWaypoint.latitude, prevWaypoint.longitude,
      point.latitude, point.longitude
    );

    // Calculate heading
    const heading = calculateBearing(
      prevWaypoint.latitude, prevWaypoint.longitude,
      point.latitude, point.longitude
    );

    // Speed based on altitude
    const speed = altitude > 10000 ? cruiseSpeed : 250;
    const segmentTime = (segmentDistance / speed) * 60;

    cumulativeDistance += segmentDistance;
    cumulativeTime += segmentTime;

    // Generate waypoint name
    const waypointName = generateWaypointName(i);

    waypoints.push({
      id: `ENR${String(i + 1).padStart(2, '0')}`,
      name: waypointName,
      type: 'ENROUTE',
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: Math.round(altitude / 100) * 100, // Round to nearest 100ft
      speed,
      distanceFromPrev: Math.round(segmentDistance * 10) / 10,
      cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
      timeFromPrev: Math.round(segmentTime * 10) / 10,
      cumulativeTime: Math.round(cumulativeTime * 10) / 10,
      heading: Math.round(heading),
    });
  }

  // ========================================
  // 4. STAR ENTRY POINT
  // ========================================
  const starDistance = 20;
  const starFraction = (totalDistance - starDistance) / totalDistance;
  const starPoint = interpolateGreatCircle(
    departure.latitude, departure.longitude,
    arrival.latitude, arrival.longitude,
    starFraction
  );

  const prevWaypoint = waypoints[waypoints.length - 1];
  const toStarDistance = calculateDistanceNm(
    prevWaypoint.latitude, prevWaypoint.longitude,
    starPoint.latitude, starPoint.longitude
  );

  const starHeading = calculateBearing(
    prevWaypoint.latitude, prevWaypoint.longitude,
    starPoint.latitude, starPoint.longitude
  );

  const toStarTime = (toStarDistance / 300) * 60; // Descending speed
  cumulativeDistance += toStarDistance;
  cumulativeTime += toStarTime;

  waypoints.push({
    id: 'STAR01',
    name: `${arrival.icao}ARR`,
    type: 'STAR',
    latitude: starPoint.latitude,
    longitude: starPoint.longitude,
    altitude: 10000,
    speed: 250,
    distanceFromPrev: Math.round(toStarDistance * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(toStarTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: Math.round(starHeading),
  });

  // ========================================
  // 5. APPROACH WAYPOINT
  // ========================================
  const approachDistance = 8;
  const approachFraction = (totalDistance - approachDistance) / totalDistance;
  const approachPoint = interpolateGreatCircle(
    departure.latitude, departure.longitude,
    arrival.latitude, arrival.longitude,
    approachFraction
  );

  const toApproachDistance = calculateDistanceNm(
    starPoint.latitude, starPoint.longitude,
    approachPoint.latitude, approachPoint.longitude
  );

  const approachHeading = calculateBearing(
    starPoint.latitude, starPoint.longitude,
    approachPoint.latitude, approachPoint.longitude
  );

  const toApproachTime = (toApproachDistance / 180) * 60;
  cumulativeDistance += toApproachDistance;
  cumulativeTime += toApproachTime;

  waypoints.push({
    id: 'APP01',
    name: 'FINAL',
    type: 'APPROACH',
    latitude: approachPoint.latitude,
    longitude: approachPoint.longitude,
    altitude: 3000,
    speed: 180,
    distanceFromPrev: Math.round(toApproachDistance * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(toApproachTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: Math.round(approachHeading),
  });

  // ========================================
  // 6. ARRIVAL WAYPOINT
  // ========================================
  const toArrivalDistance = calculateDistanceNm(
    approachPoint.latitude, approachPoint.longitude,
    arrival.latitude, arrival.longitude
  );

  const arrivalHeading = calculateBearing(
    approachPoint.latitude, approachPoint.longitude,
    arrival.latitude, arrival.longitude
  );

  const toArrivalTime = (toArrivalDistance / 140) * 60; // Final approach speed
  cumulativeDistance += toArrivalDistance;
  cumulativeTime += toArrivalTime;

  waypoints.push({
    id: 'ARR',
    name: arrival.icao,
    type: 'ARRIVAL',
    latitude: arrival.latitude,
    longitude: arrival.longitude,
    altitude: arrival.elevation,
    speed: 140,
    distanceFromPrev: Math.round(toArrivalDistance * 10) / 10,
    cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
    timeFromPrev: Math.round(toArrivalTime * 10) / 10,
    cumulativeTime: Math.round(cumulativeTime * 10) / 10,
    heading: Math.round(arrivalHeading),
  });

  // ========================================
  // BUILD GEOJSON
  // ========================================
  const coordinates: [number, number][] = waypoints.map(wp => [wp.longitude, wp.latitude]);

  const geoJson = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
        properties: {
          name: `${departure.icao}-${arrival.icao}`,
          type: 'route',
        },
      },
    ],
  };

  return {
    departure,
    arrival,
    waypoints,
    totalDistance: Math.round(cumulativeDistance * 10) / 10,
    totalTime: Math.round(cumulativeTime),
    cruiseAltitude,
    initialClimbAltitude: climbAltitude,
    geoJson,
  };
}

/**
 * Generate 5-letter waypoint name (ICAO format)
 */
function generateWaypointName(index: number): string {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  
  // Create pseudo-random but deterministic name based on index
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
 */
export function getPositionOnRoute(
  route: FlightRoute,
  progress: number // 0 to 1
): {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  currentWaypoint: RouteWaypoint;
  nextWaypoint: RouteWaypoint | null;
  distanceFlown: number;
  timeElapsed: number;
} {
  // Clamp progress
  const p = Math.max(0, Math.min(1, progress));
  
  // Find current segment
  const targetDistance = p * route.totalDistance;
  
  let currentIdx = 0;
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    if (route.waypoints[i + 1].cumulativeDistance >= targetDistance) {
      currentIdx = i;
      break;
    }
  }

  const currentWp = route.waypoints[currentIdx];
  const nextWp = route.waypoints[currentIdx + 1] || null;

  if (!nextWp) {
    // At destination
    return {
      latitude: currentWp.latitude,
      longitude: currentWp.longitude,
      altitude: currentWp.altitude,
      heading: currentWp.heading,
      speed: currentWp.speed,
      currentWaypoint: currentWp,
      nextWaypoint: null,
      distanceFlown: route.totalDistance,
      timeElapsed: route.totalTime,
    };
  }

  // Calculate position within segment
  const segmentStartDist = currentWp.cumulativeDistance;
  const segmentEndDist = nextWp.cumulativeDistance;
  const segmentLength = segmentEndDist - segmentStartDist;
  const progressInSegment = segmentLength > 0 
    ? (targetDistance - segmentStartDist) / segmentLength 
    : 0;

  // Interpolate position (great circle)
  const position = interpolateGreatCircle(
    currentWp.latitude, currentWp.longitude,
    nextWp.latitude, nextWp.longitude,
    progressInSegment
  );

  // Interpolate altitude
  const altitude = currentWp.altitude + (nextWp.altitude - currentWp.altitude) * progressInSegment;

  // Interpolate speed
  const speed = currentWp.speed + (nextWp.speed - currentWp.speed) * progressInSegment;

  // Calculate heading to next waypoint
  const heading = calculateBearing(
    position.latitude, position.longitude,
    nextWp.latitude, nextWp.longitude
  );

  // Calculate time elapsed
  const segmentStartTime = currentWp.cumulativeTime;
  const segmentEndTime = nextWp.cumulativeTime;
  const timeInSegment = (segmentEndTime - segmentStartTime) * progressInSegment;
  const timeElapsed = segmentStartTime + timeInSegment;

  return {
    latitude: position.latitude,
    longitude: position.longitude,
    altitude: Math.round(altitude),
    heading: Math.round(heading),
    speed: Math.round(speed),
    currentWaypoint: currentWp,
    nextWaypoint: nextWp,
    distanceFlown: Math.round(targetDistance * 10) / 10,
    timeElapsed: Math.round(timeElapsed),
  };
}

/**
 * Get route points for smooth animation
 * Returns array of positions for animation timeline
 */
export function getRouteAnimationPoints(
  route: FlightRoute,
  numPoints: number = 100
): Array<{
  progress: number;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
}> {
  const points: Array<{
    progress: number;
    latitude: number;
    longitude: number;
    altitude: number;
    heading: number;
    speed: number;
  }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const progress = i / numPoints;
    const position = getPositionOnRoute(route, progress);
    
    points.push({
      progress,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      heading: position.heading,
      speed: position.speed,
    });
  }

  return points;
}
