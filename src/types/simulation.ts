/**
 * Simulation Types - FS2024-Level Architecture
 * 
 * OWNERSHIP: This file defines ALL types for simulation.
 * 
 * KEY PRINCIPLE: SimulationSnapshot is IMMUTABLE.
 * It is created ONCE when transitioning from PLANNING → SIMULATION.
 * Simulation code MUST NOT import or read from planning state.
 */

// ============================================================================
// FLIGHT PHASES
// ============================================================================

export type FlightPhase =
  | 'LINEUP'          // Stationary at threshold, heading locked
  | 'TAKEOFF_ROLL'    // Accelerating, heading locked, on runway
  | 'V1'              // Past decision speed, committed
  | 'ROTATE'          // Pitching up, heading locked, on runway
  | 'LIFTOFF'         // Wheels up, heading still ~runway
  | 'INITIAL_CLIMB'   // Climbing, beginning turn to course
  | 'CLIMB'           // Climbing to cruise, following route
  | 'CRUISE'          // At altitude, following route
  | 'DESCENT'         // Descending, following route
  | 'APPROACH'        // On approach path
  | 'FINAL'           // On final, aligned with runway
  | 'LANDING'         // Touchdown and rollout
  | 'TAXI_IN'         // Taxiing to gate
  | 'COMPLETE';       // Simulation ended

// ============================================================================
// RUNWAY UNIT VECTOR
// ============================================================================

/**
 * Pre-computed unit vector for runway direction.
 * Used for 1D → 2D position conversion during ground roll.
 */
export interface RunwayUnitVector {
  readonly dLatPerNm: number;
  readonly dLonPerNm: number;
}

// ============================================================================
// SIMULATION SNAPSHOT (IMMUTABLE)
// ============================================================================

/**
 * IMMUTABLE input to simulation.
 * Created ONCE when entering simulation mode.
 * Simulation code MUST NOT import planningStore.
 */
export interface SimulationSnapshot {
  /** Frozen at moment of simulation start */
  readonly createdAt: number;
  
  /** Departure runway - all values from explicit threshold data */
  readonly departure: Readonly<{
    airportIcao: string;
    runwayDesignator: string;
    
    // Explicit coordinates (NOT derived from airport center)
    thresholdLat: number;
    thresholdLon: number;
    oppositeThresholdLat: number;
    oppositeThresholdLon: number;
    
    // Computed from threshold coordinates
    runwayHeadingTrue: number;       // degrees
    runwayLengthFt: number;          // feet
    runwayLengthNm: number;          // nautical miles
    
    // Pre-computed unit vector (degrees per nm along runway)
    runwayUnitVector: Readonly<RunwayUnitVector>;
    
    elevationFt: number;
  }>;
  
  /** Arrival runway */
  readonly arrival: Readonly<{
    airportIcao: string;
    runwayDesignator: string;
    thresholdLat: number;
    thresholdLon: number;
    oppositeThresholdLat: number;
    oppositeThresholdLon: number;
    runwayHeadingTrue: number;
    runwayLengthFt: number;
    runwayLengthNm: number;
    runwayUnitVector: Readonly<RunwayUnitVector>;
    elevationFt: number;
  }>;
  
  /** Aircraft performance - frozen from dispatcher */
  readonly aircraft: Readonly<{
    icaoType: string;
    
    // V-speeds (knots IAS)
    v1: number;    // Decision speed
    vR: number;    // Rotation speed
    v2: number;    // Takeoff safety speed
    vRef: number;  // Landing reference speed
    
    // Takeoff performance
    takeoffDistanceRequiredFt: number;
    groundAccelerationKtsPerSec: number;  // Typical: 2.5-4 kts/sec
    rotationPitchRate: number;            // deg/sec (typical: 3)
    initialClimbPitchDeg: number;         // deg (typical: 15)
    
    // Climb performance
    initialClimbRateFpm: number;
    cruiseClimbRateFpm: number;
    
    // Cruise performance
    cruiseSpeedKts: number;
    cruiseAltitudeFt: number;
    
    // Descent performance
    descentRateFpm: number;
    approachSpeedKts: number;
  }>;
  
  /** Route waypoints - frozen, cannot be modified */
  readonly route: Readonly<{
    waypoints: ReadonlyArray<Readonly<{
      id: string;
      lat: number;
      lon: number;
      altitudeFt: number;
      type: 'DEPARTURE' | 'ENROUTE' | 'ARRIVAL';
    }>>;
    totalDistanceNm: number;
    estimatedTimeMin: number;
  }>;
}

// ============================================================================
// PHASE STATE (MUTABLE)
// ============================================================================

/**
 * Current state during simulation.
 * This IS mutable - updated every frame.
 */
export interface PhaseState {
  // Current phase
  phase: FlightPhase;
  
  // Ground roll tracking (only valid during LINEUP/ROLL/V1/ROTATE/LIFTOFF)
  distanceAlongRunwayFt: number;
  
  // Route tracking (only valid after INITIAL_CLIMB)
  distanceAlongRouteNm: number;
  currentWaypointIndex: number;
  
  // Position (computed from above)
  position: { lat: number; lon: number };
  
  // Attitude
  headingTrue: number;    // degrees
  pitchDeg: number;       // degrees (0 = level, positive = nose up)
  bankDeg: number;        // degrees (0 = wings level)
  
  // Performance
  indicatedAirspeedKts: number;
  groundSpeedKts: number;
  altitudeFt: number;
  verticalSpeedFpm: number;
  
  // Timing
  phaseElapsedSec: number;
  totalElapsedSec: number;
  
  // Playback control
  isPlaying: boolean;
  isPaused: boolean;
  playbackSpeed: number;
}

// ============================================================================
// SIMULATION OUTPUT (FOR MAP)
// ============================================================================

/**
 * Read-only output for map rendering.
 * Map receives this and NOTHING else from simulation.
 */
export interface SimulationOutput {
  readonly position: { readonly lat: number; readonly lon: number };
  readonly headingTrue: number;
  readonly altitudeFt: number;
  readonly groundSpeedKts: number;
  readonly phase: FlightPhase;
  readonly isPlaying: boolean;
}

// ============================================================================
// INITIAL STATE FACTORY
// ============================================================================

/**
 * Create initial PhaseState at LINEUP.
 */
export function createInitialPhaseState(snapshot: SimulationSnapshot): PhaseState {
  return {
    phase: 'LINEUP',
    distanceAlongRunwayFt: 0,
    distanceAlongRouteNm: 0,
    currentWaypointIndex: 0,
    position: {
      lat: snapshot.departure.thresholdLat,
      lon: snapshot.departure.thresholdLon,
    },
    headingTrue: snapshot.departure.runwayHeadingTrue,
    pitchDeg: 0,
    bankDeg: 0,
    indicatedAirspeedKts: 0,
    groundSpeedKts: 0,
    altitudeFt: snapshot.departure.elevationFt,
    verticalSpeedFpm: 0,
    phaseElapsedSec: 0,
    totalElapsedSec: 0,
    isPlaying: false,
    isPaused: false,
    playbackSpeed: 1,
  };
}

/**
 * Convert PhaseState to read-only SimulationOutput for map.
 */
export function toSimulationOutput(state: PhaseState): SimulationOutput {
  return Object.freeze({
    position: Object.freeze({ ...state.position }),
    headingTrue: state.headingTrue,
    altitudeFt: state.altitudeFt,
    groundSpeedKts: state.groundSpeedKts,
    phase: state.phase,
    isPlaying: state.isPlaying,
  });
}
