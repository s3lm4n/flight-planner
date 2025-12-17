/**
 * Route Calculator
 * 
 * Generates complete flight plans with legs, times, and fuel calculations.
 */

import {
  Airport,
  Aircraft,
  FlightPlan,
  FlightLeg,
  Waypoint,
  Coordinate,
  RouteSegmentType,
} from '@/types';
import {
  calculateDistance,
  calculateBearing,
} from './aviation';
import { getSIDsForRunway, getSTARsForRunway, getApproachesForRunway } from '@/data/procedures';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a waypoint from coordinates
 */
function createWaypoint(id: string, position: Coordinate, name?: string): Waypoint {
  return { id, position, name };
}

/**
 * Create a flight leg between two waypoints
 */
function createLeg(
  from: Waypoint,
  to: Waypoint,
  segmentType: RouteSegmentType,
  aircraft: Aircraft,
  cruiseAltitude: number
): FlightLeg {
  const distance = calculateDistance(from.position, to.position);
  const course = calculateBearing(from.position, to.position);
  
  // Calculate altitude based on segment
  let altitude: number;
  let groundSpeed: number;
  
  switch (segmentType) {
    case 'TAXI_OUT':
    case 'TAXI_IN':
      altitude = 0;
      groundSpeed = 15; // Taxi speed
      break;
    case 'SID':
      altitude = Math.min(15000, cruiseAltitude / 2);
      groundSpeed = aircraft.performance.climbSpeed;
      break;
    case 'ENROUTE':
      altitude = cruiseAltitude;
      groundSpeed = aircraft.performance.cruiseSpeed;
      break;
    case 'STAR':
      altitude = Math.min(12000, cruiseAltitude / 3);
      groundSpeed = aircraft.performance.descentSpeed;
      break;
    case 'APPROACH':
      altitude = 3000;
      groundSpeed = Math.min(250, aircraft.performance.descentSpeed);
      break;
    default:
      altitude = cruiseAltitude;
      groundSpeed = aircraft.performance.cruiseSpeed;
  }
  
  // Calculate time (minutes)
  const ete = groundSpeed > 0 ? (distance / groundSpeed) * 60 : 0;
  
  // Calculate fuel (kg) - simplified: hours * fuel burn rate
  const fuelRequired = (ete / 60) * aircraft.performance.fuelBurn;
  
  return {
    id: `${from.id}-${to.id}`,
    from,
    to,
    segmentType,
    distance,
    course,
    altitude,
    groundSpeed,
    ete,
    fuelRequired,
  };
}

/**
 * Calculate appropriate cruise altitude based on distance and direction
 */
export function calculateCruiseAltitude(
  distance: number,
  course: number,
  aircraft: Aircraft
): number {
  // Semicircular rule: East (0-179) = odd thousands, West (180-359) = even thousands
  const isEastbound = course >= 0 && course < 180;
  
  // Base altitude depends on direction
  let baseAltitude: number;
  
  // Adjust for distance
  if (distance < 200) {
    baseAltitude = isEastbound ? 23000 : 24000;
  } else if (distance < 500) {
    baseAltitude = isEastbound ? 29000 : 30000;
  } else if (distance < 1000) {
    baseAltitude = isEastbound ? 33000 : 34000;
  } else {
    baseAltitude = isEastbound ? 37000 : 38000;
  }
  
  // Don't exceed aircraft ceiling
  return Math.min(baseAltitude, aircraft.performance.serviceCeiling);
}

/**
 * Generate great circle waypoints between two points
 */
function generateEnrouteWaypoints(
  from: Coordinate,
  to: Coordinate,
  count: number = 3
): Waypoint[] {
  const waypoints: Waypoint[] = [];
  
  for (let i = 1; i <= count; i++) {
    const fraction = i / (count + 1);
    
    // Simple linear interpolation (for short distances)
    // For production, use great circle interpolation
    const lat = from.lat + (to.lat - from.lat) * fraction;
    const lon = from.lon + (to.lon - from.lon) * fraction;
    
    waypoints.push(createWaypoint(
      `ENRTE${i}`,
      { lat, lon },
      `Enroute Point ${i}`
    ));
  }
  
  return waypoints;
}

// ============================================================================
// MAIN FLIGHT PLAN GENERATOR
// ============================================================================

/**
 * Generate a complete flight plan
 */
export function generateFlightPlan(
  departure: Airport,
  arrival: Airport,
  aircraft: Aircraft
): FlightPlan {
  const legs: FlightLeg[] = [];
  
  // Calculate direct route info
  const directDistance = calculateDistance(departure.position, arrival.position);
  const directCourse = calculateBearing(departure.position, arrival.position);
  const cruiseAltitude = calculateCruiseAltitude(directDistance, directCourse, aircraft);
  
  // Select runways (first available)
  const depRunway = departure.runways[0]?.id || '01';
  const arrRunway = arrival.runways[0]?.id || '01';
  
  // Try to get procedures
  const availableSIDs = getSIDsForRunway(departure.icao, depRunway);
  const availableSTARs = getSTARsForRunway(arrival.icao, arrRunway);
  const availableApproaches = getApproachesForRunway(arrival.icao, arrRunway);
  
  const selectedSID = availableSIDs[0];
  const selectedSTAR = availableSTARs[0];
  const selectedApproach = availableApproaches[0];
  
  // Starting point (parking or airport)
  let currentPosition: Waypoint;
  
  // 1. TAXI OUT
  if (departure.parking && departure.parking.length > 0) {
    const parkingSpot = departure.parking[0];
    currentPosition = createWaypoint('GATE', parkingSpot.position, parkingSpot.name);
  } else {
    currentPosition = createWaypoint(departure.icao, departure.position, departure.name);
  }
  
  const runwayThreshold = createWaypoint(
    `RW${depRunway}`,
    departure.position, // Simplified - use airport coords
    `Runway ${depRunway}`
  );
  
  legs.push(createLeg(currentPosition, runwayThreshold, 'TAXI_OUT', aircraft, cruiseAltitude));
  currentPosition = runwayThreshold;
  
  // 2. SID
  if (selectedSID && selectedSID.commonRoute.length > 0) {
    for (const waypoint of selectedSID.commonRoute) {
      const wp = createWaypoint(waypoint.id, waypoint.position, waypoint.name);
      legs.push(createLeg(currentPosition, wp, 'SID', aircraft, cruiseAltitude));
      currentPosition = wp;
    }
  } else {
    // Create synthetic SID waypoint
    const sidWp = createWaypoint(
      'SID01',
      {
        lat: departure.position.lat + (arrival.position.lat - departure.position.lat) * 0.1,
        lon: departure.position.lon + (arrival.position.lon - departure.position.lon) * 0.1,
      },
      'SID Waypoint'
    );
    legs.push(createLeg(currentPosition, sidWp, 'SID', aircraft, cruiseAltitude));
    currentPosition = sidWp;
  }
  
  // 3. ENROUTE
  // Calculate position before STAR
  let starEntryPosition: Coordinate;
  if (selectedSTAR && selectedSTAR.commonRoute.length > 0) {
    starEntryPosition = selectedSTAR.commonRoute[0].position;
  } else {
    starEntryPosition = {
      lat: arrival.position.lat - (arrival.position.lat - departure.position.lat) * 0.15,
      lon: arrival.position.lon - (arrival.position.lon - departure.position.lon) * 0.15,
    };
  }
  
  // Generate enroute waypoints
  const enrouteWaypoints = generateEnrouteWaypoints(
    currentPosition.position,
    starEntryPosition,
    Math.max(1, Math.floor(directDistance / 300)) // One waypoint per ~300nm
  );
  
  for (const wp of enrouteWaypoints) {
    legs.push(createLeg(currentPosition, wp, 'ENROUTE', aircraft, cruiseAltitude));
    currentPosition = wp;
  }
  
  // 4. STAR
  if (selectedSTAR && selectedSTAR.commonRoute.length > 0) {
    for (const waypoint of selectedSTAR.commonRoute) {
      const wp = createWaypoint(waypoint.id, waypoint.position, waypoint.name);
      legs.push(createLeg(currentPosition, wp, 'STAR', aircraft, cruiseAltitude));
      currentPosition = wp;
    }
  } else {
    // Create synthetic STAR waypoint
    const starWp = createWaypoint(
      'STAR01',
      {
        lat: arrival.position.lat - (arrival.position.lat - departure.position.lat) * 0.05,
        lon: arrival.position.lon - (arrival.position.lon - departure.position.lon) * 0.05,
      },
      'STAR Waypoint'
    );
    legs.push(createLeg(currentPosition, starWp, 'STAR', aircraft, cruiseAltitude));
    currentPosition = starWp;
  }
  
  // 5. APPROACH
  if (selectedApproach && selectedApproach.finalApproach.length > 0) {
    for (const waypoint of selectedApproach.finalApproach) {
      const wp = createWaypoint(waypoint.id, waypoint.position, waypoint.name);
      legs.push(createLeg(currentPosition, wp, 'APPROACH', aircraft, cruiseAltitude));
      currentPosition = wp;
    }
  }
  
  // Final approach to runway
  const arrivalRunwayThreshold = createWaypoint(
    `RW${arrRunway}`,
    arrival.position,
    `Runway ${arrRunway}`
  );
  legs.push(createLeg(currentPosition, arrivalRunwayThreshold, 'APPROACH', aircraft, cruiseAltitude));
  currentPosition = arrivalRunwayThreshold;
  
  // 6. TAXI IN
  if (arrival.parking && arrival.parking.length > 0) {
    const arrivalGate = createWaypoint(
      'GATE',
      arrival.parking[0].position,
      arrival.parking[0].name
    );
    legs.push(createLeg(currentPosition, arrivalGate, 'TAXI_IN', aircraft, cruiseAltitude));
  }
  
  // Calculate totals
  const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
  const totalTime = legs.reduce((sum, leg) => sum + leg.ete, 0);
  const totalFuel = legs.reduce((sum, leg) => sum + leg.fuelRequired, 0);
  
  return {
    id: `${departure.icao}-${arrival.icao}-${Date.now()}`,
    departure,
    arrival,
    aircraft,
    departureRunway: depRunway,
    arrivalRunway: arrRunway,
    sid: selectedSID,
    star: selectedSTAR,
    approach: selectedApproach,
    legs,
    summary: {
      distance: totalDistance,
      totalTime,
      cruiseAltitude,
      estimatedFuel: totalFuel * 1.1, // 10% reserve
    },
    createdAt: new Date(),
  };
}

/**
 * Get all waypoints from a flight plan
 */
export function getFlightPlanWaypoints(flightPlan: FlightPlan): Coordinate[] {
  const waypoints: Coordinate[] = [];
  
  for (const leg of flightPlan.legs) {
    if (waypoints.length === 0) {
      waypoints.push(leg.from.position);
    }
    waypoints.push(leg.to.position);
  }
  
  return waypoints;
}

/**
 * Find the leg at a given progress percentage
 */
export function findLegAtProgress(
  flightPlan: FlightPlan,
  progress: number
): { leg: FlightLeg; legIndex: number; legProgress: number } | null {
  if (flightPlan.legs.length === 0) return null;
  
  const totalDistance = flightPlan.summary.distance;
  const targetDistance = totalDistance * progress;
  
  let cumulative = 0;
  
  for (let i = 0; i < flightPlan.legs.length; i++) {
    const leg = flightPlan.legs[i];
    const legEnd = cumulative + leg.distance;
    
    if (targetDistance <= legEnd || i === flightPlan.legs.length - 1) {
      const legProgress = leg.distance > 0 
        ? (targetDistance - cumulative) / leg.distance 
        : 0;
      
      return {
        leg,
        legIndex: i,
        legProgress: Math.max(0, Math.min(1, legProgress)),
      };
    }
    
    cumulative = legEnd;
  }
  
  return null;
}
