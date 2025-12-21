/**
 * Enroute Phase Logic
 * 
 * OWNERSHIP: This file owns ALL enroute flight physics.
 * - INITIAL_CLIMB (turn to course, accelerate)
 * - CLIMB (climbing to cruise altitude)
 * - CRUISE (level flight at cruise)
 * - DESCENT (descending toward approach)
 * 
 * MOTION: Great circle interpolation along route waypoints.
 * Heading follows route (not locked to runway).
 */

import { SimulationSnapshot, PhaseState, FlightPhase } from '@/types/simulation';
import { 
  interpolateGreatCircle, 
  calculateHeading, 
  calculateDistanceNm,
  headingDifference,
  standardRateBankAngle,
} from '@/services/geometry/runwayGeometry';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Standard rate turn: 3 degrees per second */
const STANDARD_RATE_DEG_PER_SEC = 3;

/** Top of descent buffer (nm before destination) */
const TOD_BUFFER_NM = 50;

// ============================================================================
// PHASE ADVANCERS
// ============================================================================

/**
 * Advance INITIAL_CLIMB phase.
 * 
 * Aircraft turns toward first waypoint while climbing.
 * Exit: When heading aligned with route AND speed >= climb speed.
 */
export function advanceInitialClimb(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, route } = snapshot;
  
  // Find first enroute waypoint (skip departure threshold)
  const targetWpIndex = Math.max(1, state.currentWaypointIndex);
  const targetWp = route.waypoints[targetWpIndex];
  
  if (!targetWp) {
    // No waypoints, transition to cruise anyway
    return { ...state, phase: 'CLIMB', phaseElapsedSec: 0 };
  }
  
  // Target heading to waypoint
  const targetHeading = calculateHeading(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon
  );
  
  // Turn toward target (standard rate)
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Bank angle during turn
  const newBankDeg = Math.abs(headingDiff) > 1 
    ? Math.sign(headingDiff) * standardRateBankAngle(state.indicatedAirspeedKts)
    : 0;
  
  // Speed: Accelerating toward climb speed (250 kts below 10000ft, cruise otherwise)
  const targetSpeed = state.altitudeFt < 10000 
    ? Math.min(250, aircraft.cruiseSpeedKts)
    : aircraft.cruiseSpeedKts * 0.85;
  
  const speedDelta = targetSpeed - state.indicatedAirspeedKts;
  const accel = 2.0;  // kts/sec (slower than ground)
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), accel * deltaTimeSec);
  
  // Continue climbing
  const newAltitudeFt = state.altitudeFt + (aircraft.initialClimbRateFpm * deltaTimeSec / 60);
  
  // Move along heading
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;  // nm traveled
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon,
    distanceNm / calculateDistanceNm(state.position.lat, state.position.lon, targetWp.lat, targetWp.lon)
  );
  
  // Update distance along route
  const newDistanceAlongRouteNm = state.distanceAlongRouteNm + distanceNm;
  
  // Check if we've passed current waypoint
  const distToWp = calculateDistanceNm(newPosition.lat, newPosition.lon, targetWp.lat, targetWp.lon);
  let newWpIndex = targetWpIndex;
  if (distToWp < 1) {  // Within 1nm of waypoint
    newWpIndex = Math.min(targetWpIndex + 1, route.waypoints.length - 1);
  }
  
  // Exit condition: Heading aligned AND established in climb
  const headingAligned = Math.abs(headingDiff) < 5;
  const speedEstablished = newSpeedKts >= targetSpeed * 0.95;
  
  if (headingAligned && speedEstablished) {
    return {
      ...state,
      phase: 'CLIMB',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: newHeading,
      bankDeg: 0,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      altitudeFt: newAltitudeFt,
      distanceAlongRouteNm: newDistanceAlongRouteNm,
      currentWaypointIndex: newWpIndex,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: newHeading,
    bankDeg: newBankDeg,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    altitudeFt: newAltitudeFt,
    distanceAlongRouteNm: newDistanceAlongRouteNm,
    currentWaypointIndex: newWpIndex,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance CLIMB phase.
 * 
 * Aircraft climbing to cruise altitude while following route.
 * Exit: When altitude >= cruise altitude.
 */
export function advanceClimb(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, route } = snapshot;
  
  // Target waypoint
  const targetWpIndex = state.currentWaypointIndex;
  const targetWp = route.waypoints[Math.min(targetWpIndex, route.waypoints.length - 1)];
  
  // Heading to waypoint
  const targetHeading = calculateHeading(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon
  );
  
  // Smooth turn
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Speed: Climb speed (below 10000ft: 250kts, above: Mach climb ~280-300kts)
  const targetSpeed = state.altitudeFt < 10000 
    ? Math.min(250, aircraft.cruiseSpeedKts)
    : Math.min(300, aircraft.cruiseSpeedKts * 0.85);
  
  const speedDelta = targetSpeed - state.indicatedAirspeedKts;
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), 1.5 * deltaTimeSec);
  
  // Climbing
  const climbRate = aircraft.cruiseClimbRateFpm;
  const newAltitudeFt = Math.min(
    state.altitudeFt + (climbRate * deltaTimeSec / 60),
    aircraft.cruiseAltitudeFt
  );
  
  // Move along route
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;
  const distToWp = calculateDistanceNm(state.position.lat, state.position.lon, targetWp.lat, targetWp.lon);
  const fraction = Math.min(distanceNm / Math.max(distToWp, 0.1), 1);
  
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon,
    fraction
  );
  
  const newDistanceAlongRouteNm = state.distanceAlongRouteNm + distanceNm;
  
  // Check waypoint passage
  let newWpIndex = targetWpIndex;
  const newDistToWp = calculateDistanceNm(newPosition.lat, newPosition.lon, targetWp.lat, targetWp.lon);
  if (newDistToWp < 1) {
    newWpIndex = Math.min(targetWpIndex + 1, route.waypoints.length - 1);
  }
  
  // Exit condition: Reached cruise altitude
  if (newAltitudeFt >= aircraft.cruiseAltitudeFt) {
    return {
      ...state,
      phase: 'CRUISE',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: newHeading,
      bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 15 : 0,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      altitudeFt: aircraft.cruiseAltitudeFt,
      verticalSpeedFpm: 0,
      distanceAlongRouteNm: newDistanceAlongRouteNm,
      currentWaypointIndex: newWpIndex,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: newHeading,
    bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 15 : 0,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    altitudeFt: newAltitudeFt,
    verticalSpeedFpm: climbRate,
    distanceAlongRouteNm: newDistanceAlongRouteNm,
    currentWaypointIndex: newWpIndex,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance CRUISE phase.
 * 
 * Level flight at cruise altitude following route.
 * Exit: When approaching top of descent.
 */
export function advanceCruise(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, route, arrival } = snapshot;
  
  // Target waypoint
  const targetWpIndex = state.currentWaypointIndex;
  const targetWp = route.waypoints[Math.min(targetWpIndex, route.waypoints.length - 1)];
  
  // Heading to waypoint
  const targetHeading = calculateHeading(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon
  );
  
  // Smooth turn
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Speed: Cruise speed
  const speedDelta = aircraft.cruiseSpeedKts - state.indicatedAirspeedKts;
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), 1.0 * deltaTimeSec);
  
  // Move along route
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;
  const distToWp = calculateDistanceNm(state.position.lat, state.position.lon, targetWp.lat, targetWp.lon);
  const fraction = Math.min(distanceNm / Math.max(distToWp, 0.1), 1);
  
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    targetWp.lat, targetWp.lon,
    fraction
  );
  
  const newDistanceAlongRouteNm = state.distanceAlongRouteNm + distanceNm;
  
  // Check waypoint passage
  let newWpIndex = targetWpIndex;
  const newDistToWp = calculateDistanceNm(newPosition.lat, newPosition.lon, targetWp.lat, targetWp.lon);
  if (newDistToWp < 1) {
    newWpIndex = Math.min(targetWpIndex + 1, route.waypoints.length - 1);
  }
  
  // Check for top of descent
  const distToDestination = calculateDistanceNm(
    newPosition.lat, newPosition.lon,
    arrival.thresholdLat, arrival.thresholdLon
  );
  
  // TOD calculation: Need to descend from cruise to approach altitude
  // Rule of thumb: 3nm per 1000ft (3:1 gradient)
  const altitudeToLose = aircraft.cruiseAltitudeFt - 3000;  // Approach altitude ~3000ft
  const todDistanceNm = altitudeToLose / 1000 * 3;
  
  if (distToDestination <= todDistanceNm + TOD_BUFFER_NM) {
    return {
      ...state,
      phase: 'DESCENT',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: newHeading,
      bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 10 : 0,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      distanceAlongRouteNm: newDistanceAlongRouteNm,
      currentWaypointIndex: newWpIndex,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: newHeading,
    bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 10 : 0,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    altitudeFt: aircraft.cruiseAltitudeFt,
    verticalSpeedFpm: 0,
    distanceAlongRouteNm: newDistanceAlongRouteNm,
    currentWaypointIndex: newWpIndex,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance DESCENT phase.
 * 
 * Descending toward approach altitude.
 * Exit: When altitude <= approach altitude AND close to airport.
 */
export function advanceDescent(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, route, arrival } = snapshot;
  
  // Target waypoint
  const targetWpIndex = state.currentWaypointIndex;
  const targetWp = route.waypoints[Math.min(targetWpIndex, route.waypoints.length - 1)];
  
  // Heading to waypoint (or arrival if near end)
  const distToArrival = calculateDistanceNm(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon
  );
  
  const targetLat = distToArrival < 30 ? arrival.thresholdLat : targetWp.lat;
  const targetLon = distToArrival < 30 ? arrival.thresholdLon : targetWp.lon;
  
  const targetHeading = calculateHeading(
    state.position.lat, state.position.lon,
    targetLat, targetLon
  );
  
  // Smooth turn
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Speed: Slowing toward approach speed
  const targetSpeed = state.altitudeFt < 10000 
    ? Math.min(250, aircraft.cruiseSpeedKts * 0.7)
    : aircraft.cruiseSpeedKts * 0.8;
  
  const speedDelta = targetSpeed - state.indicatedAirspeedKts;
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), 2.0 * deltaTimeSec);
  
  // Descending
  const approachAltitude = 3000;
  const newAltitudeFt = Math.max(
    state.altitudeFt - (aircraft.descentRateFpm * deltaTimeSec / 60),
    approachAltitude
  );
  
  // Move along route
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;
  const distToTarget = calculateDistanceNm(state.position.lat, state.position.lon, targetLat, targetLon);
  const fraction = Math.min(distanceNm / Math.max(distToTarget, 0.1), 1);
  
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    targetLat, targetLon,
    fraction
  );
  
  const newDistanceAlongRouteNm = state.distanceAlongRouteNm + distanceNm;
  
  // Check waypoint passage
  let newWpIndex = targetWpIndex;
  if (distToTarget < 1) {
    newWpIndex = Math.min(targetWpIndex + 1, route.waypoints.length - 1);
  }
  
  // Exit condition: Low altitude AND close to airport
  if (newAltitudeFt <= approachAltitude && distToArrival < 20) {
    return {
      ...state,
      phase: 'APPROACH',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: newHeading,
      bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 15 : 0,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      altitudeFt: newAltitudeFt,
      verticalSpeedFpm: -aircraft.descentRateFpm,
      distanceAlongRouteNm: newDistanceAlongRouteNm,
      currentWaypointIndex: newWpIndex,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: newHeading,
    bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 15 : 0,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    altitudeFt: newAltitudeFt,
    verticalSpeedFpm: -aircraft.descentRateFpm,
    distanceAlongRouteNm: newDistanceAlongRouteNm,
    currentWaypointIndex: newWpIndex,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

// ============================================================================
// MAIN ENROUTE PHASE HANDLER
// ============================================================================

/**
 * Advance any enroute-related phase.
 * 
 * Routes to the appropriate phase handler.
 * Returns null if the current phase is not an enroute phase.
 */
export function advanceEnroutePhase(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState | null {
  switch (state.phase) {
    case 'INITIAL_CLIMB':
      return advanceInitialClimb(state, snapshot, deltaTimeSec);
    case 'CLIMB':
      return advanceClimb(state, snapshot, deltaTimeSec);
    case 'CRUISE':
      return advanceCruise(state, snapshot, deltaTimeSec);
    case 'DESCENT':
      return advanceDescent(state, snapshot, deltaTimeSec);
    default:
      return null;
  }
}

/**
 * Check if a phase is an enroute phase.
 */
export function isEnroutePhase(phase: FlightPhase): boolean {
  return ['INITIAL_CLIMB', 'CLIMB', 'CRUISE', 'DESCENT'].includes(phase);
}
