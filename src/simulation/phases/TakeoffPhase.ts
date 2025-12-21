/**
 * Takeoff Phase Logic
 * 
 * OWNERSHIP: This file owns ALL ground-phase physics.
 * - LINEUP (stationary at threshold)
 * - TAKEOFF_ROLL (accelerating, 1D along runway)
 * - V1 (past decision speed)
 * - ROTATE (pitching up)
 * - LIFTOFF (wheels leaving ground)
 * 
 * CRITICAL CONSTRAINTS:
 * 1. Position is 1D along runway vector (NOT route waypoints)
 * 2. Heading is LOCKED to runway heading until after LIFTOFF
 * 3. Uses getPositionOnRunway() for all position calculations
 */

import { SimulationSnapshot, PhaseState, FlightPhase } from '@/types/simulation';
import { getPositionOnRunway, KTS_TO_FPS } from '@/services/geometry/runwayGeometry';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Pitch angle at which wheels leave ground */
const LIFTOFF_PITCH_DEG = 8;

/** Altitude AGL to transition to INITIAL_CLIMB */
const INITIAL_CLIMB_AGL_FT = 400;

/** Vertical speed stability threshold for INITIAL_CLIMB transition */
const VS_STABILITY_FACTOR = 0.9;

// ============================================================================
// PHASE ADVANCERS
// ============================================================================

/**
 * Advance LINEUP phase.
 * 
 * Aircraft is stationary at threshold.
 * Heading locked to runway.
 * Waiting for play command.
 */
export function advanceLineup(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  _deltaTimeSec: number
): PhaseState {
  // Position: Exactly at threshold
  // Heading: Exactly runway heading
  // Speed: 0
  // This phase just holds position
  
  return {
    ...state,
    position: {
      lat: snapshot.departure.thresholdLat,
      lon: snapshot.departure.thresholdLon,
    },
    headingTrue: snapshot.departure.runwayHeadingTrue,  // LOCKED
    distanceAlongRunwayFt: 0,
    indicatedAirspeedKts: 0,
    groundSpeedKts: 0,
    altitudeFt: snapshot.departure.elevationFt,
    verticalSpeedFpm: 0,
    pitchDeg: 0,
    bankDeg: 0,
  };
}

/**
 * Advance TAKEOFF_ROLL phase.
 * 
 * Physics: Constant acceleration along runway centerline.
 * Heading: LOCKED to runway (no steering).
 * Altitude: Ground level (runway elevation).
 * Exit: When IAS >= V1, transition to V1 phase.
 */
export function advanceTakeoffRoll(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { departure, aircraft } = snapshot;
  
  // v = v0 + a*t
  const newSpeedKts = state.indicatedAirspeedKts + 
    (aircraft.groundAccelerationKtsPerSec * deltaTimeSec);
  
  // Average speed during this timestep (for distance calculation)
  const avgSpeedKts = (state.indicatedAirspeedKts + newSpeedKts) / 2;
  
  // Convert to feet per second
  const avgSpeedFps = avgSpeedKts * KTS_TO_FPS;
  
  // Distance traveled this frame
  const distanceTraveledFt = avgSpeedFps * deltaTimeSec;
  
  // New position along runway (1D)
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + distanceTraveledFt;
  
  // Convert 1D runway distance to 2D lat/lon
  const newPosition = getPositionOnRunway(
    departure.thresholdLat,
    departure.thresholdLon,
    departure.runwayUnitVector,
    newDistanceAlongRunwayFt
  );
  
  // Check exit condition: Reached VR → transition to ROTATE
  if (newSpeedKts >= aircraft.vR) {
    return {
      ...state,
      phase: 'ROTATE',
      phaseElapsedSec: 0,  // Reset for new phase
      position: newPosition,
      distanceAlongRunwayFt: newDistanceAlongRunwayFt,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts, // No wind model
      headingTrue: departure.runwayHeadingTrue,  // STILL LOCKED
      altitudeFt: departure.elevationFt,  // Still on ground
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  // Check V1 transition
  const newPhase: FlightPhase = newSpeedKts >= aircraft.v1 ? 'V1' : 'TAKEOFF_ROLL';
  
  return {
    ...state,
    phase: newPhase,
    position: newPosition,
    distanceAlongRunwayFt: newDistanceAlongRunwayFt,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    headingTrue: departure.runwayHeadingTrue,  // LOCKED
    altitudeFt: departure.elevationFt,
    phaseElapsedSec: newPhase !== state.phase ? 0 : state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance V1 phase.
 * 
 * Same physics as TAKEOFF_ROLL, just marks that we're past decision speed.
 * Exit: When IAS >= VR, transition to ROTATE.
 */
export function advanceV1(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { departure, aircraft } = snapshot;
  
  // Same physics as TAKEOFF_ROLL
  const newSpeedKts = state.indicatedAirspeedKts + 
    (aircraft.groundAccelerationKtsPerSec * deltaTimeSec);
  
  const avgSpeedFps = ((state.indicatedAirspeedKts + newSpeedKts) / 2) * KTS_TO_FPS;
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + (avgSpeedFps * deltaTimeSec);
  
  const newPosition = getPositionOnRunway(
    departure.thresholdLat,
    departure.thresholdLon,
    departure.runwayUnitVector,
    newDistanceAlongRunwayFt
  );
  
  // Check exit condition: Reached VR
  if (newSpeedKts >= aircraft.vR) {
    return {
      ...state,
      phase: 'ROTATE',
      phaseElapsedSec: 0,
      position: newPosition,
      distanceAlongRunwayFt: newDistanceAlongRunwayFt,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      headingTrue: departure.runwayHeadingTrue,  // STILL LOCKED
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    distanceAlongRunwayFt: newDistanceAlongRunwayFt,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    headingTrue: departure.runwayHeadingTrue,  // LOCKED
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance ROTATE phase.
 * 
 * Nose pitching up while still on ground.
 * Still accelerating (slower due to increased drag).
 * Exit: When pitch >= 8° AND IAS >= V2, transition to LIFTOFF.
 */
export function advanceRotate(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { departure, aircraft } = snapshot;
  
  // Pitch up at rotation rate
  const newPitchDeg = state.pitchDeg + (aircraft.rotationPitchRate * deltaTimeSec);
  
  // Reduced acceleration during rotation (drag increase)
  const rotationAccel = aircraft.groundAccelerationKtsPerSec * 0.5;
  const newSpeedKts = state.indicatedAirspeedKts + (rotationAccel * deltaTimeSec);
  
  // Still moving along runway
  const avgSpeedFps = ((state.indicatedAirspeedKts + newSpeedKts) / 2) * KTS_TO_FPS;
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + (avgSpeedFps * deltaTimeSec);
  
  const newPosition = getPositionOnRunway(
    departure.thresholdLat,
    departure.thresholdLon,
    departure.runwayUnitVector,
    newDistanceAlongRunwayFt
  );
  
  // Check exit condition: Sufficient pitch AND speed for liftoff
  if (newPitchDeg >= LIFTOFF_PITCH_DEG && newSpeedKts >= aircraft.v2) {
    return {
      ...state,
      phase: 'LIFTOFF',
      phaseElapsedSec: 0,
      position: newPosition,
      distanceAlongRunwayFt: newDistanceAlongRunwayFt,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      headingTrue: departure.runwayHeadingTrue,  // STILL LOCKED
      pitchDeg: newPitchDeg,
      altitudeFt: departure.elevationFt,  // Last moment on ground
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    distanceAlongRunwayFt: newDistanceAlongRunwayFt,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    headingTrue: departure.runwayHeadingTrue,  // LOCKED
    pitchDeg: newPitchDeg,
    altitudeFt: departure.elevationFt,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

/**
 * Advance LIFTOFF phase.
 * 
 * Wheels leaving ground, establishing climb.
 * Pitch continues toward initial climb attitude.
 * Heading still approximately runway heading.
 * Exit: When AGL >= 400ft AND VS stabilized, transition to INITIAL_CLIMB.
 */
export function advanceLiftoff(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  const { departure, aircraft } = snapshot;
  
  // Pitch toward initial climb attitude
  const pitchDelta = aircraft.initialClimbPitchDeg - state.pitchDeg;
  const pitchChange = Math.sign(pitchDelta) * Math.min(
    Math.abs(pitchDelta),
    aircraft.rotationPitchRate * deltaTimeSec
  );
  const newPitchDeg = state.pitchDeg + pitchChange;
  
  // Speed: Accelerating toward V2+20 (slower in air)
  const newSpeedKts = Math.min(
    state.indicatedAirspeedKts + (1.5 * deltaTimeSec),
    aircraft.v2 + 20
  );
  
  // Vertical speed ramping up
  const targetVsFpm = aircraft.initialClimbRateFpm;
  const vsRampRate = 500;  // fpm per second
  const newVsFpm = Math.min(
    state.verticalSpeedFpm + (vsRampRate * deltaTimeSec),
    targetVsFpm
  );
  
  // New altitude (VS is fpm, need to convert to feet per second)
  const newAltitudeFt = state.altitudeFt + (newVsFpm * deltaTimeSec / 60);
  
  // Position: Continue along runway vector (extended centerline)
  // Still using runway-aligned motion until established in climb
  const avgSpeedFps = ((state.indicatedAirspeedKts + newSpeedKts) / 2) * KTS_TO_FPS;
  const newDistanceAlongRunwayFt = state.distanceAlongRunwayFt + (avgSpeedFps * deltaTimeSec);
  
  const newPosition = getPositionOnRunway(
    departure.thresholdLat,
    departure.thresholdLon,
    departure.runwayUnitVector,
    newDistanceAlongRunwayFt
  );
  
  // Check exit condition: Established climb
  const aglFt = newAltitudeFt - departure.elevationFt;
  const vsStable = newVsFpm >= targetVsFpm * VS_STABILITY_FACTOR;
  
  if (aglFt >= INITIAL_CLIMB_AGL_FT && vsStable) {
    return {
      ...state,
      phase: 'INITIAL_CLIMB',
      phaseElapsedSec: 0,
      position: newPosition,
      distanceAlongRunwayFt: newDistanceAlongRunwayFt,
      indicatedAirspeedKts: newSpeedKts,
      groundSpeedKts: newSpeedKts,
      headingTrue: departure.runwayHeadingTrue,  // Will unlock in INITIAL_CLIMB
      pitchDeg: newPitchDeg,
      altitudeFt: newAltitudeFt,
      verticalSpeedFpm: newVsFpm,
      totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
    };
  }
  
  return {
    ...state,
    position: newPosition,
    distanceAlongRunwayFt: newDistanceAlongRunwayFt,
    indicatedAirspeedKts: newSpeedKts,
    groundSpeedKts: newSpeedKts,
    headingTrue: departure.runwayHeadingTrue,  // Still runway-aligned
    pitchDeg: newPitchDeg,
    altitudeFt: newAltitudeFt,
    verticalSpeedFpm: newVsFpm,
    phaseElapsedSec: state.phaseElapsedSec + deltaTimeSec,
    totalElapsedSec: state.totalElapsedSec + deltaTimeSec,
  };
}

// ============================================================================
// MAIN TAKEOFF PHASE HANDLER
// ============================================================================

/**
 * Advance any takeoff-related phase.
 * 
 * Routes to the appropriate phase handler.
 * Returns null if the current phase is not a takeoff phase.
 */
export function advanceTakeoffPhase(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState | null {
  switch (state.phase) {
    case 'LINEUP':
      return advanceLineup(state, snapshot, deltaTimeSec);
    case 'TAKEOFF_ROLL':
      return advanceTakeoffRoll(state, snapshot, deltaTimeSec);
    case 'V1':
      return advanceV1(state, snapshot, deltaTimeSec);
    case 'ROTATE':
      return advanceRotate(state, snapshot, deltaTimeSec);
    case 'LIFTOFF':
      return advanceLiftoff(state, snapshot, deltaTimeSec);
    default:
      return null;  // Not a takeoff phase
  }
}

/**
 * Check if a phase is a ground/takeoff phase.
 */
export function isTakeoffPhase(phase: FlightPhase): boolean {
  return ['LINEUP', 'TAKEOFF_ROLL', 'V1', 'ROTATE', 'LIFTOFF'].includes(phase);
}
