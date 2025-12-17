/**
 * Enhanced Flight Simulation Hook
 * 
 * FIXED: Uses proper elapsed time and groundspeed for realistic movement.
 * 
 * Key improvements:
 * - Uses requestAnimationFrame with proper delta time
 * - Calculates position based on actual groundspeed and elapsed time
 * - Proper flight phase management
 * - Wind effect calculations
 * - ETA and progress tracking
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { Coordinate, FlightPlan, Wind } from '@/types';
import {
  interpolatePosition,
  calculateBearing,
  calculateWindCorrectionAngle,
  calculateGroundSpeed,
  calculateDistance,
} from '@/utils/aviation';

// ============================================================================
// TYPES
// ============================================================================

export type FlightPhase =
  | 'PREFLIGHT'
  | 'TAXI_OUT'
  | 'TAKEOFF'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'FINAL'
  | 'LANDING'
  | 'TAXI_IN'
  | 'PARKED';

export interface SimulationState {
  // Position
  position: Coordinate;
  heading: number;
  altitude: number;
  
  // Speeds
  groundSpeed: number;
  trueAirspeed: number;
  verticalSpeed: number;
  
  // Phase
  phase: FlightPhase;
  currentLegIndex: number;
  legProgress: number;
  
  // Overall
  totalProgress: number;     // 0-1
  distanceFlown: number;     // NM
  distanceRemaining: number; // NM
  
  // Time
  elapsedSeconds: number;
  etaSeconds: number;
  
  // Status
  isRunning: boolean;
  isPaused: boolean;
}

interface UseFlightSimulationOptions {
  flightPlan: FlightPlan | null;
  wind: Wind | null;
  speedMultiplier?: number;  // Default 1x, can be 2x, 5x, etc.
  onStateUpdate?: (state: SimulationState) => void;
  onPhaseChange?: (phase: FlightPhase) => void;
  onComplete?: () => void;
}

interface FlightSimulationControls {
  // State
  state: SimulationState;
  
  // Controls
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  
  // Direct manipulation
  setProgress: (progress: number) => void;
  setSpeedMultiplier: (multiplier: number) => void;
  
  // Queries
  getPositionAtProgress: (progress: number) => SimulationState | null;
}

// ============================================================================
// WAYPOINT DATA STRUCTURE
// ============================================================================

interface SimWaypoint {
  position: Coordinate;
  altitude: number;
  targetSpeed: number;       // TAS at this waypoint
  phase: FlightPhase;
  cumulativeDistance: number; // NM from start
  cumulativeTime: number;     // Seconds from start
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build waypoint array from flight plan
 */
function buildWaypoints(flightPlan: FlightPlan, wind: Wind | null): SimWaypoint[] {
  const waypoints: SimWaypoint[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;
  
  for (let i = 0; i < flightPlan.legs.length; i++) {
    const leg = flightPlan.legs[i];
    const isFirst = i === 0;
    
    // Determine phase and speeds based on segment type
    let phase: FlightPhase;
    let targetSpeed: number;
    let altitude: number;
    
    switch (leg.segmentType) {
      case 'TAXI_OUT':
        phase = 'TAXI_OUT';
        targetSpeed = 15; // knots
        altitude = flightPlan.departure.elevation;
        break;
      case 'SID':
        phase = i <= 2 ? 'TAKEOFF' : 'CLIMB';
        targetSpeed = leg.groundSpeed || 250;
        altitude = leg.altitude;
        break;
      case 'ENROUTE':
        phase = 'CRUISE';
        targetSpeed = leg.groundSpeed || 450;
        altitude = leg.altitude;
        break;
      case 'STAR':
        phase = 'DESCENT';
        targetSpeed = leg.groundSpeed || 280;
        altitude = leg.altitude;
        break;
      case 'APPROACH':
        phase = leg.altitude < 3000 ? 'FINAL' : 'APPROACH';
        targetSpeed = leg.groundSpeed || 160;
        altitude = leg.altitude;
        break;
      case 'TAXI_IN':
        phase = 'TAXI_IN';
        targetSpeed = 15;
        altitude = flightPlan.arrival.elevation;
        break;
      default:
        phase = 'CRUISE';
        targetSpeed = leg.groundSpeed || 400;
        altitude = leg.altitude;
    }
    
    // Add start waypoint for first leg
    if (isFirst) {
      waypoints.push({
        position: leg.from.position,
        altitude: flightPlan.departure.elevation,
        targetSpeed: 0,
        phase: 'PREFLIGHT',
        cumulativeDistance: 0,
        cumulativeTime: 0,
      });
    }
    
    // Calculate ground speed considering wind
    let groundSpeed = targetSpeed;
    if (wind && wind.speed > 0 && phase !== 'TAXI_OUT' && phase !== 'TAXI_IN' && phase !== 'PREFLIGHT') {
      const course = calculateBearing(leg.from.position, leg.to.position);
      groundSpeed = calculateGroundSpeed(course, targetSpeed, wind);
    }
    
    // Calculate time for this leg (hours -> seconds)
    const legDistance = leg.distance;
    const legTime = groundSpeed > 0 ? (legDistance / groundSpeed) * 3600 : 0;
    
    cumulativeDistance += legDistance;
    cumulativeTime += legTime;
    
    // Add end waypoint
    waypoints.push({
      position: leg.to.position,
      altitude,
      targetSpeed,
      phase,
      cumulativeDistance,
      cumulativeTime,
    });
  }
  
  // Mark final waypoint
  if (waypoints.length > 0) {
    waypoints[waypoints.length - 1].phase = 'PARKED';
    waypoints[waypoints.length - 1].targetSpeed = 0;
  }
  
  return waypoints;
}

/**
 * Get phase from segment type at a given progress
 */
function determinePhase(
  prevPhase: FlightPhase,
  nextPhase: FlightPhase,
  legProgress: number
): FlightPhase {
  // Use next phase when we're more than halfway through the leg
  return legProgress > 0.5 ? nextPhase : prevPhase;
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useFlightSimulation(
  options: UseFlightSimulationOptions
): FlightSimulationControls {
  const {
    flightPlan,
    wind,
    speedMultiplier: initialMultiplier = 1,
    onStateUpdate,
    onPhaseChange,
    onComplete,
  } = options;
  
  // Refs for animation
  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const waypointsRef = useRef<SimWaypoint[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);
  const speedMultiplierRef = useRef<number>(initialMultiplier);
  const previousPhaseRef = useRef<FlightPhase>('PREFLIGHT');
  
  // Simulation state
  const [state, setState] = useState<SimulationState>(() => createInitialState());
  
  /**
   * Create initial simulation state
   */
  function createInitialState(): SimulationState {
    const initialPosition = flightPlan?.departure.position || { lat: 0, lon: 0 };
    const initialAltitude = flightPlan?.departure.elevation || 0;
    
    return {
      position: initialPosition,
      heading: flightPlan?.legs[0]?.course || 0,
      altitude: initialAltitude,
      groundSpeed: 0,
      trueAirspeed: 0,
      verticalSpeed: 0,
      phase: 'PREFLIGHT',
      currentLegIndex: 0,
      legProgress: 0,
      totalProgress: 0,
      distanceFlown: 0,
      distanceRemaining: totalDistanceRef.current,
      elapsedSeconds: 0,
      etaSeconds: totalTimeRef.current,
      isRunning: false,
      isPaused: false,
    };
  }
  
  /**
   * Build waypoints when flight plan changes
   */
  useEffect(() => {
    if (!flightPlan) {
      waypointsRef.current = [];
      totalDistanceRef.current = 0;
      totalTimeRef.current = 0;
      setState(createInitialState());
      return;
    }
    
    const waypoints = buildWaypoints(flightPlan, wind);
    waypointsRef.current = waypoints;
    
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      totalDistanceRef.current = lastWp.cumulativeDistance;
      totalTimeRef.current = lastWp.cumulativeTime;
    }
    
    setState(createInitialState());
  }, [flightPlan, wind]);
  
  /**
   * Calculate simulation state at a given progress (0-1)
   */
  const calculateStateAtProgress = useCallback((progress: number): SimulationState | null => {
    const waypoints = waypointsRef.current;
    if (!flightPlan || waypoints.length < 2) return null;
    
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetDistance = totalDistanceRef.current * clampedProgress;
    
    // Find current leg
    let legIndex = 0;
    let prevWp = waypoints[0];
    let nextWp = waypoints[1];
    
    for (let i = 1; i < waypoints.length; i++) {
      if (waypoints[i].cumulativeDistance >= targetDistance) {
        legIndex = i - 1;
        prevWp = waypoints[i - 1];
        nextWp = waypoints[i];
        break;
      }
      if (i === waypoints.length - 1) {
        legIndex = i - 1;
        prevWp = waypoints[i - 1];
        nextWp = waypoints[i];
      }
    }
    
    // Calculate progress within leg
    const legStartDist = prevWp.cumulativeDistance;
    const legEndDist = nextWp.cumulativeDistance;
    const legLength = legEndDist - legStartDist;
    const legProgress = legLength > 0 ? (targetDistance - legStartDist) / legLength : 0;
    
    // Interpolate position using great circle
    const position = interpolatePosition(
      prevWp.position,
      nextWp.position,
      legProgress
    );
    
    // Interpolate altitude
    const altitude = lerp(prevWp.altitude, nextWp.altitude, legProgress);
    
    // Calculate heading to next waypoint
    let heading = calculateBearing(position, nextWp.position);
    
    // Determine phase
    const phase = determinePhase(prevWp.phase, nextWp.phase, legProgress);
    
    // Interpolate speed
    const trueAirspeed = lerp(prevWp.targetSpeed, nextWp.targetSpeed, legProgress);
    
    // Calculate ground speed with wind
    let groundSpeed = trueAirspeed;
    if (wind && wind.speed > 0 && phase !== 'TAXI_OUT' && phase !== 'TAXI_IN' && trueAirspeed > 0) {
      groundSpeed = calculateGroundSpeed(heading, trueAirspeed, wind);
      
      // Apply wind correction angle to heading
      const wca = calculateWindCorrectionAngle(heading, trueAirspeed, wind);
      heading = (heading + wca + 360) % 360;
    }
    
    // Calculate vertical speed (fpm)
    const altitudeChange = nextWp.altitude - prevWp.altitude;
    const legTimeSeconds = legLength > 0 && groundSpeed > 0 
      ? (legLength / groundSpeed) * 3600 
      : 0;
    const verticalSpeed = legTimeSeconds > 0 
      ? (altitudeChange / legTimeSeconds) * 60 
      : 0;
    
    // Time calculations
    const elapsedSeconds = lerp(prevWp.cumulativeTime, nextWp.cumulativeTime, legProgress);
    const etaSeconds = totalTimeRef.current - elapsedSeconds;
    
    return {
      position,
      heading,
      altitude,
      groundSpeed,
      trueAirspeed,
      verticalSpeed,
      phase,
      currentLegIndex: legIndex,
      legProgress,
      totalProgress: clampedProgress,
      distanceFlown: targetDistance,
      distanceRemaining: totalDistanceRef.current - targetDistance,
      elapsedSeconds,
      etaSeconds: Math.max(0, etaSeconds),
      isRunning: state.isRunning,
      isPaused: state.isPaused,
    };
  }, [flightPlan, wind, state.isRunning, state.isPaused]);
  
  /**
   * Animation frame callback - FIXED with proper delta time
   */
  const animate = useCallback((timestamp: number) => {
    if (!state.isRunning || state.isPaused) {
      frameRef.current = null;
      return;
    }
    
    // Calculate delta time in seconds
    if (lastTimestampRef.current === 0) {
      lastTimestampRef.current = timestamp;
    }
    const deltaMs = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;
    const deltaSeconds = deltaMs / 1000;
    
    // Calculate distance covered in this frame
    // groundSpeed is in knots (NM/hour), convert to NM/second
    const currentGroundSpeed = state.groundSpeed || 1;
    const nmPerSecond = currentGroundSpeed / 3600;
    const distanceCovered = nmPerSecond * deltaSeconds * speedMultiplierRef.current;
    
    // Calculate new progress
    const totalDistance = totalDistanceRef.current;
    if (totalDistance <= 0) {
      frameRef.current = null;
      return;
    }
    
    const progressIncrement = distanceCovered / totalDistance;
    const newProgress = Math.min(1, state.totalProgress + progressIncrement);
    
    // Get new state
    const newState = calculateStateAtProgress(newProgress);
    
    if (newState) {
      // Check for phase change
      if (newState.phase !== previousPhaseRef.current) {
        previousPhaseRef.current = newState.phase;
        onPhaseChange?.(newState.phase);
      }
      
      // Update state
      const updatedState = {
        ...newState,
        isRunning: true,
        isPaused: false,
      };
      
      setState(updatedState);
      onStateUpdate?.(updatedState);
      
      // Check for completion
      if (newProgress >= 1) {
        setState(prev => ({ ...prev, isRunning: false }));
        onComplete?.();
        frameRef.current = null;
        return;
      }
    }
    
    // Continue animation
    frameRef.current = requestAnimationFrame(animate);
  }, [state.isRunning, state.isPaused, state.groundSpeed, state.totalProgress, calculateStateAtProgress, onStateUpdate, onPhaseChange, onComplete]);
  
  /**
   * Start animation loop
   */
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      lastTimestampRef.current = 0;
      frameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [state.isRunning, state.isPaused, animate]);
  
  // ============================================================================
  // CONTROL FUNCTIONS
  // ============================================================================
  
  const start = useCallback(() => {
    if (!flightPlan || waypointsRef.current.length < 2) return;
    
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
    }));
  }, [flightPlan]);
  
  const pause = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: true,
    }));
  }, []);
  
  const resume = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
    }));
  }, []);
  
  const stop = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
    }));
  }, []);
  
  const reset = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setState(createInitialState());
    previousPhaseRef.current = 'PREFLIGHT';
  }, []);
  
  const setProgress = useCallback((progress: number) => {
    const newState = calculateStateAtProgress(progress);
    if (newState) {
      setState(prev => ({
        ...newState,
        isRunning: prev.isRunning,
        isPaused: prev.isPaused,
      }));
    }
  }, [calculateStateAtProgress]);
  
  const setSpeedMultiplier = useCallback((multiplier: number) => {
    speedMultiplierRef.current = Math.max(0.1, Math.min(100, multiplier));
  }, []);
  
  return {
    state,
    start,
    pause,
    resume,
    stop,
    reset,
    setProgress,
    setSpeedMultiplier,
    getPositionAtProgress: calculateStateAtProgress,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Extract wind from METAR for simulation
 */
export function extractWindFromMetar(metar: { wind?: { direction: number; speed: number; gust?: number } }): Wind | null {
  if (!metar.wind || metar.wind.speed === 0) {
    return null;
  }
  
  return {
    direction: metar.wind.direction,
    speed: metar.wind.speed,
    gust: metar.wind.gust,
  };
}

/**
 * Format flight phase for display
 */
export function formatPhase(phase: FlightPhase): string {
  const labels: Record<FlightPhase, string> = {
    PREFLIGHT: 'Pre-Flight',
    TAXI_OUT: 'Taxi Out',
    TAKEOFF: 'Takeoff',
    CLIMB: 'Climb',
    CRUISE: 'Cruise',
    DESCENT: 'Descent',
    APPROACH: 'Approach',
    FINAL: 'Final Approach',
    LANDING: 'Landing',
    TAXI_IN: 'Taxi In',
    PARKED: 'Parked',
  };
  return labels[phase];
}

/**
 * Get phase color for UI
 */
export function getPhaseColor(phase: FlightPhase): string {
  const colors: Record<FlightPhase, string> = {
    PREFLIGHT: 'gray',
    TAXI_OUT: 'yellow',
    TAKEOFF: 'orange',
    CLIMB: 'blue',
    CRUISE: 'green',
    DESCENT: 'purple',
    APPROACH: 'indigo',
    FINAL: 'red',
    LANDING: 'orange',
    TAXI_IN: 'yellow',
    PARKED: 'gray',
  };
  return colors[phase];
}
