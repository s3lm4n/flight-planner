/**
 * Enhanced Flight Simulation System
 * 
 * Realistic flight simulation with proper:
 * - Phase-based flight progression (taxi, takeoff, climb, cruise, descent, approach, landing, taxi)
 * - Speed and altitude calculations based on aircraft performance
 * - Wind effects on ground speed and heading
 * - Precise waypoint interpolation along the route
 * - Time-based progression using actual ground speed
 */

import { Coordinate, Wind, FlightPlan } from '@/types';
import { EnhancedAircraft } from '@/types/aircraft';
import {
  calculateBearing,
  interpolatePosition,
  calculateGroundSpeed,
  calculateWindCorrectionAngle,
} from '@/utils/aviation';

// ============================================================================
// TYPES
// ============================================================================

/** Flight phase */
export type FlightPhase = 
  | 'PREFLIGHT'
  | 'TAXI_OUT'
  | 'TAKEOFF'
  | 'INITIAL_CLIMB'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'FINAL'
  | 'LANDING'
  | 'TAXI_IN'
  | 'PARKED';

/** Simulation state */
export interface SimulationState {
  // Position
  position: Coordinate;
  altitude: number;        // feet MSL
  heading: number;         // degrees true
  
  // Speeds
  groundSpeed: number;     // knots
  trueAirspeed: number;    // knots
  verticalSpeed: number;   // feet per minute
  
  // Phase info
  phase: FlightPhase;
  currentLegIndex: number;
  legProgress: number;     // 0-1 within current leg
  
  // Overall progress
  totalProgress: number;   // 0-1 for entire flight
  distanceFlown: number;   // nautical miles
  distanceRemaining: number;
  
  // Time
  elapsedTime: number;     // seconds
  estimatedTimeRemaining: number; // seconds
  
  // Target values
  targetAltitude: number;
  targetSpeed: number;
}

/** Simulation configuration */
export interface SimulationConfig {
  aircraft: EnhancedAircraft;
  flightPlan: FlightPlan;
  wind: Wind | null;
  speedMultiplier: number;  // For faster-than-realtime simulation
}

/** Waypoint with enhanced data for simulation */
interface SimulationWaypoint {
  position: Coordinate;
  altitude: number;
  speed: number;
  phase: FlightPhase;
  cumulativeDistance: number;
  estimatedTime: number;  // cumulative time to reach this waypoint
}

// ============================================================================
// SIMULATION WAYPOINT BUILDER
// ============================================================================

/**
 * Build simulation waypoints from flight plan
 * Includes altitude and speed profile
 */
export function buildSimulationWaypoints(
  flightPlan: FlightPlan,
  aircraft: EnhancedAircraft,
  wind: Wind | null
): SimulationWaypoint[] {
  const waypoints: SimulationWaypoint[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;
  
  for (let i = 0; i < flightPlan.legs.length; i++) {
    const leg = flightPlan.legs[i];
    const isFirst = i === 0;
    
    // Determine phase from segment type
    let phase: FlightPhase;
    let altitude: number;
    let speed: number;
    
    switch (leg.segmentType) {
      case 'TAXI_OUT':
        phase = 'TAXI_OUT';
        altitude = flightPlan.departure.elevation;
        speed = 15;  // Taxi speed
        break;
      case 'SID':
        phase = i === 1 ? 'TAKEOFF' : 'CLIMB';
        altitude = leg.altitude;
        speed = aircraft.speeds.climbSpeed;
        break;
      case 'ENROUTE':
        phase = 'CRUISE';
        altitude = flightPlan.summary.cruiseAltitude;
        speed = aircraft.speeds.cruiseSpeed;
        break;
      case 'STAR':
        phase = 'DESCENT';
        altitude = leg.altitude;
        speed = aircraft.speeds.descentSpeed;
        break;
      case 'APPROACH':
        phase = leg.altitude < 1500 ? 'FINAL' : 'APPROACH';
        altitude = leg.altitude;
        speed = Math.min(aircraft.speeds.vApp + 20, 250);
        break;
      case 'TAXI_IN':
        phase = 'TAXI_IN';
        altitude = flightPlan.arrival.elevation;
        speed = 15;
        break;
      default:
        phase = 'CRUISE';
        altitude = leg.altitude;
        speed = aircraft.speeds.cruiseSpeed;
    }
    
    // Add start waypoint for first leg
    if (isFirst) {
      waypoints.push({
        position: leg.from.position,
        altitude: flightPlan.departure.elevation,
        speed: 0,
        phase: 'PREFLIGHT',
        cumulativeDistance: 0,
        estimatedTime: 0,
      });
    }
    
    // Calculate ground speed with wind
    let groundSpeed = speed;
    if (wind && wind.speed > 0 && phase !== 'TAXI_OUT' && phase !== 'TAXI_IN') {
      const course = calculateBearing(leg.from.position, leg.to.position);
      groundSpeed = calculateGroundSpeed(course, speed, wind);
    }
    
    // Calculate time for this leg
    const legDistance = leg.distance;
    const legTime = groundSpeed > 0 ? (legDistance / groundSpeed) * 3600 : 0;
    
    cumulativeDistance += legDistance;
    cumulativeTime += legTime;
    
    // Add end waypoint
    waypoints.push({
      position: leg.to.position,
      altitude,
      speed,
      phase,
      cumulativeDistance,
      estimatedTime: cumulativeTime,
    });
  }
  
  // Mark final waypoint as parked
  if (waypoints.length > 0) {
    waypoints[waypoints.length - 1].phase = 'PARKED';
    waypoints[waypoints.length - 1].speed = 0;
  }
  
  return waypoints;
}

// ============================================================================
// CORE SIMULATION CLASS
// ============================================================================

export class FlightSimulation {
  private config: SimulationConfig;
  private waypoints: SimulationWaypoint[];
  private state: SimulationState;
  private totalDistance: number;
  private totalTime: number;
  
  constructor(config: SimulationConfig) {
    this.config = config;
    this.waypoints = buildSimulationWaypoints(
      config.flightPlan,
      config.aircraft,
      config.wind
    );
    
    // Calculate totals
    this.totalDistance = this.waypoints.length > 0 
      ? this.waypoints[this.waypoints.length - 1].cumulativeDistance 
      : 0;
    this.totalTime = this.waypoints.length > 0
      ? this.waypoints[this.waypoints.length - 1].estimatedTime
      : 0;
    
    // Initialize state
    this.state = this.createInitialState();
  }
  
  private createInitialState(): SimulationState {
    const departure = this.config.flightPlan.departure;
    
    return {
      position: { ...departure.position },
      altitude: departure.elevation,
      heading: this.config.flightPlan.legs[0]?.course || 0,
      groundSpeed: 0,
      trueAirspeed: 0,
      verticalSpeed: 0,
      phase: 'PREFLIGHT',
      currentLegIndex: 0,
      legProgress: 0,
      totalProgress: 0,
      distanceFlown: 0,
      distanceRemaining: this.totalDistance,
      elapsedTime: 0,
      estimatedTimeRemaining: this.totalTime,
      targetAltitude: departure.elevation,
      targetSpeed: 0,
    };
  }
  
  /**
   * Get current state
   */
  getState(): SimulationState {
    return { ...this.state };
  }
  
  /**
   * Get waypoints for visualization
   */
  getWaypoints(): SimulationWaypoint[] {
    return this.waypoints;
  }
  
  /**
   * Get total flight distance
   */
  getTotalDistance(): number {
    return this.totalDistance;
  }
  
  /**
   * Get total flight time (seconds)
   */
  getTotalTime(): number {
    return this.totalTime;
  }
  
  /**
   * Reset simulation to beginning
   */
  reset(): void {
    this.state = this.createInitialState();
  }
  
  /**
   * Set simulation to a specific progress (0-1)
   */
  setProgress(progress: number): SimulationState {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetDistance = this.totalDistance * clampedProgress;
    
    // Find the leg we're on
    let legIndex = 0;
    let prevWaypoint = this.waypoints[0];
    let nextWaypoint = this.waypoints[1];
    
    for (let i = 1; i < this.waypoints.length; i++) {
      if (this.waypoints[i].cumulativeDistance >= targetDistance) {
        legIndex = i - 1;
        prevWaypoint = this.waypoints[i - 1];
        nextWaypoint = this.waypoints[i];
        break;
      }
      if (i === this.waypoints.length - 1) {
        legIndex = i - 1;
        prevWaypoint = this.waypoints[i - 1];
        nextWaypoint = this.waypoints[i];
      }
    }
    
    // Calculate progress within leg
    const legStartDistance = prevWaypoint.cumulativeDistance;
    const legEndDistance = nextWaypoint.cumulativeDistance;
    const legLength = legEndDistance - legStartDistance;
    const legProgress = legLength > 0 ? (targetDistance - legStartDistance) / legLength : 0;
    
    // Interpolate position along great circle
    const position = interpolatePosition(
      prevWaypoint.position,
      nextWaypoint.position,
      legProgress
    );
    
    // Interpolate altitude
    const altitude = prevWaypoint.altitude + 
      (nextWaypoint.altitude - prevWaypoint.altitude) * legProgress;
    
    // Calculate heading (bearing to next waypoint)
    let heading = calculateBearing(position, nextWaypoint.position);
    
    // Apply wind correction if in flight
    const phase = this.determinePhase(legProgress, prevWaypoint.phase, nextWaypoint.phase);
    if (this.config.wind && this.config.wind.speed > 0 && 
        phase !== 'TAXI_OUT' && phase !== 'TAXI_IN' && phase !== 'PARKED' && phase !== 'PREFLIGHT') {
      const wca = calculateWindCorrectionAngle(
        heading,
        this.interpolateSpeed(prevWaypoint.speed, nextWaypoint.speed, legProgress),
        this.config.wind
      );
      heading = (heading + wca + 360) % 360;
    }
    
    // Calculate speeds
    const trueAirspeed = this.interpolateSpeed(prevWaypoint.speed, nextWaypoint.speed, legProgress);
    let groundSpeed = trueAirspeed;
    
    if (this.config.wind && this.config.wind.speed > 0 && trueAirspeed > 0) {
      const course = calculateBearing(prevWaypoint.position, nextWaypoint.position);
      groundSpeed = calculateGroundSpeed(course, trueAirspeed, this.config.wind);
    }
    
    // Calculate vertical speed
    const altitudeChange = nextWaypoint.altitude - prevWaypoint.altitude;
    const legTimeSeconds = legLength > 0 && groundSpeed > 0 
      ? (legLength / groundSpeed) * 3600 
      : 0;
    const verticalSpeed = legTimeSeconds > 0 
      ? (altitudeChange / legTimeSeconds) * 60  // Convert to ft/min
      : 0;
    
    // Calculate times
    const elapsedTime = this.totalTime * clampedProgress;
    const estimatedTimeRemaining = this.totalTime - elapsedTime;
    
    // Update state
    this.state = {
      position,
      altitude: Math.round(altitude),
      heading: Math.round(heading),
      groundSpeed: Math.round(groundSpeed),
      trueAirspeed: Math.round(trueAirspeed),
      verticalSpeed: Math.round(verticalSpeed),
      phase,
      currentLegIndex: legIndex,
      legProgress,
      totalProgress: clampedProgress,
      distanceFlown: targetDistance,
      distanceRemaining: this.totalDistance - targetDistance,
      elapsedTime,
      estimatedTimeRemaining,
      targetAltitude: nextWaypoint.altitude,
      targetSpeed: nextWaypoint.speed,
    };
    
    return this.state;
  }
  
  /**
   * Advance simulation by delta time (seconds)
   */
  update(deltaTimeSeconds: number): SimulationState {
    if (this.state.totalProgress >= 1) {
      return this.state;
    }
    
    // Apply speed multiplier
    const effectiveDelta = deltaTimeSeconds * this.config.speedMultiplier;
    
    // Calculate progress increment based on elapsed time
    const progressIncrement = this.totalTime > 0 
      ? effectiveDelta / this.totalTime 
      : 0;
    
    const newProgress = Math.min(1, this.state.totalProgress + progressIncrement);
    
    return this.setProgress(newProgress);
  }
  
  /**
   * Determine flight phase based on leg progress
   */
  private determinePhase(
    legProgress: number,
    prevPhase: FlightPhase,
    nextPhase: FlightPhase
  ): FlightPhase {
    // Use previous phase for most of the leg, switch to next near the end
    if (legProgress < 0.9) {
      return prevPhase;
    }
    return nextPhase;
  }
  
  /**
   * Interpolate speed between waypoints
   */
  private interpolateSpeed(startSpeed: number, endSpeed: number, progress: number): number {
    // Use smooth acceleration/deceleration
    const smoothProgress = this.smoothStep(progress);
    return startSpeed + (endSpeed - startSpeed) * smoothProgress;
  }
  
  /**
   * Smooth step function for smoother transitions
   */
  private smoothStep(x: number): number {
    return x * x * (3 - 2 * x);
  }
  
  /**
   * Check if simulation is complete
   */
  isComplete(): boolean {
    return this.state.totalProgress >= 1;
  }
  
  /**
   * Get position at specific progress for route preview
   */
  getPositionAtProgress(progress: number): Coordinate {
    const prevState = { ...this.state };
    this.setProgress(progress);
    const position = { ...this.state.position };
    this.state = prevState;
    return position;
  }
}

// ============================================================================
// ANIMATION HOOK HELPER
// ============================================================================

/**
 * Create a flight simulation from flight plan
 */
export function createFlightSimulation(
  flightPlan: FlightPlan,
  aircraft: EnhancedAircraft,
  wind: Wind | null,
  speedMultiplier: number = 1
): FlightSimulation {
  return new FlightSimulation({
    aircraft,
    flightPlan,
    wind,
    speedMultiplier,
  });
}

/**
 * Calculate estimated flight time in minutes
 */
export function calculateFlightTime(
  flightPlan: FlightPlan,
  aircraft: EnhancedAircraft,
  wind: Wind | null
): number {
  const simulation = createFlightSimulation(flightPlan, aircraft, wind);
  return simulation.getTotalTime() / 60;  // Convert to minutes
}

/**
 * Get phase display name
 */
export function getPhaseDisplayName(phase: FlightPhase): string {
  const names: Record<FlightPhase, string> = {
    PREFLIGHT: 'Pre-flight',
    TAXI_OUT: 'Taxi Out',
    TAKEOFF: 'Takeoff',
    INITIAL_CLIMB: 'Initial Climb',
    CLIMB: 'Climb',
    CRUISE: 'Cruise',
    DESCENT: 'Descent',
    APPROACH: 'Approach',
    FINAL: 'Final Approach',
    LANDING: 'Landing',
    TAXI_IN: 'Taxi In',
    PARKED: 'Parked',
  };
  return names[phase];
}

/**
 * Format time for display (HH:MM:SS)
 */
export function formatFlightTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
