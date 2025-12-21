/**
 * Landing Phase Logic
 * 
 * OWNERSHIP: This file owns ALL approach/landing physics.
 * - APPROACH (on approach path)
 * - FINAL (aligned with runway)
 * - LANDING (touchdown and rollout)
 * - TAXI_IN (to gate)
 * - COMPLETE (simulation ended)
 * 
 * MOTION: 
 * - APPROACH/FINAL: Interpolating toward runway threshold
 * - LANDING/TAXI_IN: 1D along arrival runway (like takeoff but reversed)
 */

import { SimulationSnapshot, PhaseState } from '@/types/simulation';
import { 
  calculateHeading, 
  calculateDistanceNm,
  headingDifference,
  interpolateGreatCircle,
  getPositionOnRunway,
  KTS_TO_FPS
} from '@/services/geometry/runwayGeometry';

// ============================================================================
// CONSTANTS
// ============================================================================

const STANDARD_RATE_DEG_PER_SEC = 3;
const GLIDESLOPE_DEG = 3;

// ============================================================================
// PHASE ADVANCERS
// ============================================================================

/**
 * Advance APPROACH phase.
 * 
 * Aircraft maneuvering toward final approach.
 * Exit: When aligned with runway AND on glideslope intercept.
 */
export function advanceApproach(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, arrival } = snapshot;
  
  // Target: Final approach fix (about 10nm from threshold)
  const distToThreshold = calculateDistanceNm(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon
  );
  
  // Heading to runway
  const targetHeading = calculateHeading(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon
  );
  
  // Turn toward runway
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Speed: Slowing to approach speed
  const targetSpeed = aircraft.approachSpeedKts + 20;
  const speedDelta = targetSpeed - state.indicatedAirspeedKts;
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), 3.0 * deltaTimeSec);
  
  // Altitude: Descending to intercept glideslope
  // Glideslope intercept altitude = distance * tan(3°) converted to feet
  const gsInterceptAlt = distToThreshold * 6076 * Math.tan(GLIDESLOPE_DEG * Math.PI / 180) + arrival.elevationFt;
  const targetAlt = Math.max(gsInterceptAlt, arrival.elevationFt + 1500);
  
  let newAltitudeFt = state.altitudeFt;
  let newVsFpm = state.verticalSpeedFpm;
  
  if (state.altitudeFt > targetAlt) {
    newVsFpm = -1500;
    newAltitudeFt = Math.max(state.altitudeFt + (newVsFpm * deltaTimeSec / 60), targetAlt);
  } else {
    newVsFpm = 0;
  }
  
  // Move toward threshold
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;
  const fraction = Math.min(distanceNm / Math.max(distToThreshold, 0.1), 1);
  
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon,
    fraction
  );
  
  // Exit condition: Close to threshold AND aligned
  const runwayHeadingDiff = Math.abs(headingDifference(newHeading, arrival.runwayHeadingTrue));
  
  if (distToThreshold < 10 && runwayHeadingDiff < 15) {
    return {
      ...state,
      phase: 'FINAL',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: newHeading,
      bankDeg: Math.abs(headingDiff) > 1 ? Math.sign(headingDiff) * 15 : 0,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      altitudeFt: newAltitudeFt,
      verticalSpeedFpm: newVsFpm,
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
    verticalSpeedFpm: newVsFpm,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance FINAL phase.
 * 
 * Aircraft on final approach, aligned with runway.
 * Heading locked to runway heading.
 * Following glideslope.
 * Exit: When altitude <= decision height (touchdown).
 */
export function advanceFinal(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { aircraft, arrival } = snapshot;
  
  // Lock heading to runway
  const targetHeading = arrival.runwayHeadingTrue;
  const headingDiff = headingDifference(state.headingTrue, targetHeading);
  const maxTurn = STANDARD_RATE_DEG_PER_SEC * deltaTimeSec;
  const turnAmount = Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), maxTurn);
  const newHeading = (state.headingTrue + turnAmount + 360) % 360;
  
  // Speed: Final approach speed (VRef + 5)
  const targetSpeed = aircraft.vRef + 5;
  const speedDelta = targetSpeed - state.indicatedAirspeedKts;
  const newSpeedKts = state.indicatedAirspeedKts + 
    Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), 2.0 * deltaTimeSec);
  
  // Distance to threshold
  const distToThreshold = calculateDistanceNm(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon
  );
  
  // Glideslope descent
  const gsAltitude = distToThreshold * 6076 * Math.tan(GLIDESLOPE_DEG * Math.PI / 180) + arrival.elevationFt;
  const altError = state.altitudeFt - gsAltitude;
  
  // VS to follow glideslope: ~700 fpm at typical approach speeds
  const gsVsFpm = -newSpeedKts * 101.3 * Math.tan(GLIDESLOPE_DEG * Math.PI / 180);
  const newVsFpm = gsVsFpm - (altError * 5);  // Correction for being off glideslope
  
  const newAltitudeFt = Math.max(
    state.altitudeFt + (newVsFpm * deltaTimeSec / 60),
    arrival.elevationFt
  );
  
  // Move toward threshold
  const distanceNm = (newSpeedKts / 3600) * deltaTimeSec * 60;
  const fraction = Math.min(distanceNm / Math.max(distToThreshold, 0.01), 1);
  
  const newPosition = interpolateGreatCircle(
    state.position.lat, state.position.lon,
    arrival.thresholdLat, arrival.thresholdLon,
    fraction
  );
  
  // Exit condition: Touchdown (at or below runway elevation)
  const agl = newAltitudeFt - arrival.elevationFt;
  
  if (agl <= 50 || distToThreshold < 0.1) {  // Near touchdown
    return {
      ...state,
      phase: 'LANDING',
      phaseElapsedSec: 0,
      position: {
        lat: arrival.thresholdLat,
        lon: arrival.thresholdLon,
      },
      headingTrue: arrival.runwayHeadingTrue,
      bankDeg: 0,
      pitchDeg: 2,  // Flare
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      altitudeFt: arrival.elevationFt,
      verticalSpeedFpm: 0,
      distanceAlongRunwayFt: 0,  // Start at threshold
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: newHeading,
    bankDeg: 0,
    pitchDeg: -3,  // Nose slightly down on approach
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    altitudeFt: newAltitudeFt,
    verticalSpeedFpm: newVsFpm,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance LANDING phase.
 * 
 * Touchdown and deceleration on runway.
 * Motion: 1D along arrival runway (reversed from takeoff).
 * Exit: When speed < taxi speed.
 */
export function advanceLanding(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { arrival } = snapshot;
  const TAXI_SPEED_KTS = 20;
  const DECEL_KTS_PER_SEC = 4;  // Braking deceleration
  
  // Decelerate
  const newSpeedKts = Math.max(
    state.indicatedAirspeedKts - (DECEL_KTS_PER_SEC * deltaTimeSec),
    TAXI_SPEED_KTS
  );
  
  // Distance traveled (1D along runway)
  const avgSpeedFps = ((state.indicatedAirspeedKts + newSpeedKts) / 2) * KTS_TO_FPS;
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + (avgSpeedFps * deltaTimeSec);
  
  // Position on runway (using arrival runway unit vector, but we're moving AWAY from threshold)
  // So we add distance in the direction of the runway heading
  const newPosition = getPositionOnRunway(
    arrival.thresholdLat,
    arrival.thresholdLon,
    arrival.runwayUnitVector,
    newDistanceAlongRunwayFt
  );
  
  // Pitch: Nose lowering after touchdown
  const newPitchDeg = Math.max(state.pitchDeg - (2 * deltaTimeSec), 0);
  
  // Exit condition: Taxi speed reached
  if (newSpeedKts <= TAXI_SPEED_KTS) {
    return {
      ...state,
      phase: 'TAXI_IN',
      phaseElapsedSec: 0,
      position: newPosition,
      headingTrue: arrival.runwayHeadingTrue,
      pitchDeg: 0,
      indicatedAirspeedKts: TAXI_SPEED_KTS,
      groundSpeedKts: TAXI_SPEED_KTS,
      distanceAlongRunwayFt: newDistanceAlongRunwayFt,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    headingTrue: arrival.runwayHeadingTrue,
    pitchDeg: newPitchDeg,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    distanceAlongRunwayFt: newDistanceAlongRunwayFt,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance TAXI_IN phase.
 * 
 * Taxiing at slow speed.
 * Exit: After a short duration (simulating taxi to gate).
 */
export function advanceTaxiIn(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { arrival } = snapshot;
  const TAXI_SPEED_KTS = 15;
  const TAXI_DURATION_SEC = 30;  // Simplified taxi
  
  // Slow taxi
  const newSpeedKts = Math.max(
    state.indicatedAirspeedKts - (0.5 * deltaTimeSec),
    TAXI_SPEED_KTS
  );
  
  // Continue along runway/taxiway
  const avgSpeedFps = newSpeedKts * KTS_TO_FPS;
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + (avgSpeedFps * deltaTimeSec);
  
  const newPosition = getPositionOnRunway(
    arrival.thresholdLat,
    arrival.thresholdLon,
    arrival.runwayUnitVector,
    Math.min(newDistanceAlongRunwayFt, arrival.runwayLengthFt * 0.8)  // Don't go past runway
  );
  
  // Exit condition: Taxi complete
  if (state.phaseElapsedSec + deltaTimeSec >= TAXI_DURATION_SEC) {
    return {
      ...state,
      phase: 'COMPLETE',
      phaseElapsedSec: 0,
      position: newPosition,
      indicatedAirspeedKts: 0,
      groundSpeedKts: 0,
      isPlaying: false,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

// ============================================================================
// MAIN LANDING PHASE HANDLER
// ============================================================================

/**
 * Advance any landing-related phase.
 * 
 * Routes to the appropriate phase handler.
 * Returns null if the current phase is not a landing phase.
 */
export function advanceLandingPhase(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState | null {
  switch (state.phase) {
    case 'APPROACH':
      return advanceApproach(state, snapshot, deltaTimeSec);
    case 'FINAL':
      return advanceFinal(state, snapshot, deltaTimeSec);
    case 'LANDING':
      return advanceLanding(state, snapshot, deltaTimeSec);
    case 'TAXI_IN':
      return advanceTaxiIn(state, snapshot, deltaTimeSec);
    case 'COMPLETE':
      return state;  // No change
    default:
      return null;
  }
}

/**
 * Check if a phase is a landing phase.
 */
export function isLandingPhase(phase: string): boolean {
  return ['APPROACH', 'FINAL', 'LANDING', 'TAXI_IN', 'COMPLETE'].includes(phase);
}
