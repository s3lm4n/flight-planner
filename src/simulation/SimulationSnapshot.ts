/**
 * Simulation Snapshot Creator
 * 
 * OWNERSHIP: This file owns the PLANNING → SIMULATION transition.
 * 
 * Creates an IMMUTABLE SimulationSnapshot from planning state.
 * This function is called ONCE when entering simulation mode.
 * After creation, simulation MUST NOT read from planning state.
 */

import { SimulationSnapshot } from '@/types/simulation';
import { SelectedRunway, Runway } from '@/types/runway';
import { 
  calculateRunwayUnitVector, 
  calculateHeading,
  calculateDistanceNm,
  calculateDistanceFt
} from '@/services/geometry/runwayGeometry';
import { AircraftPerformance } from '@/services/dispatcher/dispatcherService';
import { FlightRoute } from '@/services/route/runwayBasedRouteCalculator';

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Planning state required to create a snapshot.
 * This is the ONLY interface between planning and simulation.
 */
export interface PlanningStateForSnapshot {
  departureIcao: string;
  arrivalIcao: string;
  departureRunway: SelectedRunway;
  arrivalRunway: SelectedRunway;
  aircraft: AircraftPerformance;
  route: FlightRoute;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that planning state is complete for simulation.
 * Returns array of error messages (empty if valid).
 */
export function validatePlanningState(planning: Partial<PlanningStateForSnapshot>): string[] {
  const errors: string[] = [];
  
  if (!planning.departureIcao) {
    errors.push('Departure airport required');
  }
  
  if (!planning.arrivalIcao) {
    errors.push('Arrival airport required');
  }
  
  if (!planning.departureRunway) {
    errors.push('Departure runway required');
  } else if (!planning.departureRunway.end?.threshold) {
    errors.push('Departure runway missing threshold coordinates');
  }
  
  if (!planning.arrivalRunway) {
    errors.push('Arrival runway required');
  } else if (!planning.arrivalRunway.end?.threshold) {
    errors.push('Arrival runway missing threshold coordinates');
  }
  
  if (!planning.aircraft) {
    errors.push('Aircraft selection required');
  }
  
  if (!planning.route) {
    errors.push('Flight route required');
  } else if (!planning.route.waypoints || planning.route.waypoints.length < 2) {
    errors.push('Route must have at least 2 waypoints');
  }
  
  return errors;
}

// ============================================================================
// V-SPEED CALCULATIONS
// ============================================================================

/**
 * Calculate V1 (decision speed).
 * Simplified: ~85% of VR
 */
function calculateV1(aircraft: AircraftPerformance): number {
  const vR = calculateVR(aircraft);
  return Math.round(vR * 0.92);
}

/**
 * Calculate VR (rotation speed).
 * Simplified: Based on cruise speed and typical ratios
 */
function calculateVR(aircraft: AircraftPerformance): number {
  // Typical VR is about 35-40% of cruise speed for jets
  return Math.round(aircraft.cruiseSpeedKts * 0.38);
}

/**
 * Calculate V2 (takeoff safety speed).
 * Simplified: VR + 10-15 knots
 */
function calculateV2(aircraft: AircraftPerformance): number {
  return calculateVR(aircraft) + 12;
}

/**
 * Calculate VRef (landing reference speed).
 * Simplified: Based on cruise speed
 */
function calculateVRef(aircraft: AircraftPerformance): number {
  return Math.round(aircraft.cruiseSpeedKts * 0.32);
}

/**
 * Calculate ground acceleration based on aircraft type.
 * Typical values: 2.5-4 kts/sec for jets
 */
function calculateGroundAcceleration(aircraft: AircraftPerformance): number {
  // Heavier aircraft accelerate slower
  // Use takeoff distance as proxy for weight class
  const takeoffDistFt = aircraft.takeoffDistanceM * 3.28084;
  
  if (takeoffDistFt > 10000) return 2.5;  // Heavy (747, A380)
  if (takeoffDistFt > 7000) return 3.0;   // Large (777, A350)
  if (takeoffDistFt > 5000) return 3.5;   // Medium (737, A320)
  return 4.0;                              // Small jets
}

// ============================================================================
// OPPOSITE THRESHOLD FINDER
// ============================================================================

/**
 * Find the opposite threshold of a runway.
 */
function findOppositeEnd(runway: Runway, currentDesignator: string): typeof runway.ends[0] {
  const opposite = runway.ends.find(e => e.designator !== currentDesignator);
  if (!opposite) {
    throw new Error(`Cannot find opposite end for runway ${currentDesignator}`);
  }
  return opposite;
}

// ============================================================================
// SNAPSHOT CREATION
// ============================================================================

/**
 * Create an IMMUTABLE simulation snapshot from planning state.
 * 
 * This function is called ONCE when transitioning PLANNING → SIMULATION.
 * After this point, simulation MUST NOT read from planning state.
 * 
 * @throws Error if planning state is incomplete
 */
export function createSimulationSnapshot(planning: PlanningStateForSnapshot): SimulationSnapshot {
  // Validate
  const errors = validatePlanningState(planning);
  if (errors.length > 0) {
    throw new Error(`Cannot create simulation snapshot: ${errors.join(', ')}`);
  }
  
  const { departureRunway, arrivalRunway, aircraft, route } = planning;
  
  // Extract runway data
  const depEnd = departureRunway.end;
  const depRunway = departureRunway.runway;
  const arrEnd = arrivalRunway.end;
  const arrRunway = arrivalRunway.runway;
  
  // Get opposite thresholds
  const depOppositeEnd = findOppositeEnd(depRunway, depEnd.designator);
  const arrOppositeEnd = findOppositeEnd(arrRunway, arrEnd.designator);
  
  // Calculate departure runway geometry
  const depLengthNm = calculateDistanceNm(
    depEnd.threshold.lat, depEnd.threshold.lon,
    depOppositeEnd.threshold.lat, depOppositeEnd.threshold.lon
  );
  
  const depLengthFt = calculateDistanceFt(
    depEnd.threshold.lat, depEnd.threshold.lon,
    depOppositeEnd.threshold.lat, depOppositeEnd.threshold.lon
  );
  
  const depUnitVector = calculateRunwayUnitVector(
    depEnd.threshold.lat, depEnd.threshold.lon,
    depOppositeEnd.threshold.lat, depOppositeEnd.threshold.lon
  );
  
  const depHeading = calculateHeading(
    depEnd.threshold.lat, depEnd.threshold.lon,
    depOppositeEnd.threshold.lat, depOppositeEnd.threshold.lon
  );
  
  // Calculate arrival runway geometry
  const arrLengthNm = calculateDistanceNm(
    arrEnd.threshold.lat, arrEnd.threshold.lon,
    arrOppositeEnd.threshold.lat, arrOppositeEnd.threshold.lon
  );
  
  const arrLengthFt = calculateDistanceFt(
    arrEnd.threshold.lat, arrEnd.threshold.lon,
    arrOppositeEnd.threshold.lat, arrOppositeEnd.threshold.lon
  );
  
  const arrUnitVector = calculateRunwayUnitVector(
    arrEnd.threshold.lat, arrEnd.threshold.lon,
    arrOppositeEnd.threshold.lat, arrOppositeEnd.threshold.lon
  );
  
  const arrHeading = calculateHeading(
    arrEnd.threshold.lat, arrEnd.threshold.lon,
    arrOppositeEnd.threshold.lat, arrOppositeEnd.threshold.lon
  );
  
  // Freeze route waypoints
  const frozenWaypoints = route.waypoints.map(wp => Object.freeze({
    id: wp.id || wp.name,
    lat: wp.position.lat,
    lon: wp.position.lon,
    altitudeFt: wp.altitude,
    type: mapWaypointType(wp.type),
  }));
  
  // Create deeply frozen snapshot
  const snapshot: SimulationSnapshot = Object.freeze({
    createdAt: Date.now(),
    
    departure: Object.freeze({
      airportIcao: planning.departureIcao,
      runwayDesignator: depEnd.designator,
      thresholdLat: depEnd.threshold.lat,
      thresholdLon: depEnd.threshold.lon,
      oppositeThresholdLat: depOppositeEnd.threshold.lat,
      oppositeThresholdLon: depOppositeEnd.threshold.lon,
      runwayHeadingTrue: depHeading,
      runwayLengthFt: depLengthFt,
      runwayLengthNm: depLengthNm,
      runwayUnitVector: Object.freeze({ ...depUnitVector }),
      elevationFt: depEnd.elevation,
    }),
    
    arrival: Object.freeze({
      airportIcao: planning.arrivalIcao,
      runwayDesignator: arrEnd.designator,
      thresholdLat: arrEnd.threshold.lat,
      thresholdLon: arrEnd.threshold.lon,
      oppositeThresholdLat: arrOppositeEnd.threshold.lat,
      oppositeThresholdLon: arrOppositeEnd.threshold.lon,
      runwayHeadingTrue: arrHeading,
      runwayLengthFt: arrLengthFt,
      runwayLengthNm: arrLengthNm,
      runwayUnitVector: Object.freeze({ ...arrUnitVector }),
      elevationFt: arrEnd.elevation,
    }),
    
    aircraft: Object.freeze({
      icaoType: aircraft.icaoCode || 'UNKN',
      v1: calculateV1(aircraft),
      vR: calculateVR(aircraft),
      v2: calculateV2(aircraft),
      vRef: calculateVRef(aircraft),
      takeoffDistanceRequiredFt: aircraft.takeoffDistanceM * 3.28084,
      groundAccelerationKtsPerSec: calculateGroundAcceleration(aircraft),
      rotationPitchRate: 3.0,           // deg/sec (typical for jets)
      initialClimbPitchDeg: 15,         // deg (typical)
      initialClimbRateFpm: 2500,        // fpm
      cruiseClimbRateFpm: 1500,         // fpm
      cruiseSpeedKts: aircraft.cruiseSpeedKts,
      cruiseAltitudeFt: aircraft.cruiseAltitudeFt,
      descentRateFpm: 2000,             // fpm
      approachSpeedKts: calculateVRef(aircraft) + 5,
    }),
    
    route: Object.freeze({
      waypoints: Object.freeze(frozenWaypoints),
      totalDistanceNm: route.totalDistance,
      estimatedTimeMin: route.totalTime,
    }),
  });
  
  return snapshot;
}

/**
 * Map waypoint type to simulation type.
 */
function mapWaypointType(type: string): 'DEPARTURE' | 'ENROUTE' | 'ARRIVAL' {
  switch (type) {
    case 'THRESHOLD':
    case 'DEPARTURE':
    case 'SID':
      return 'DEPARTURE';
    case 'THRESHOLD_ARR':
    case 'ARRIVAL':
    case 'STAR':
    case 'APPROACH':
      return 'ARRIVAL';
    default:
      return 'ENROUTE';
  }
}
