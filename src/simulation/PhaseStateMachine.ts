/**
 * Phase State Machine
 * 
 * OWNERSHIP: This file owns ALL phase transitions and the main simulation loop.
 * 
 * This is the ONLY file that:
 * - Calls phase advancers
 * - Manages playback state (play/pause/stop)
 * - Provides the React hook for simulation
 * 
 * Does NOT own:
 * - Individual phase physics (delegated to phase files)
 * - Snapshot creation (delegated to SimulationSnapshot.ts)
 * - Geometry calculations (delegated to runwayGeometry.ts)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  SimulationSnapshot, 
  PhaseState, 
  FlightPhase,
  SimulationOutput,
  createInitialPhaseState,
  toSimulationOutput
} from '@/types/simulation';
import { advanceTakeoffPhase, isTakeoffPhase } from './phases/TakeoffPhase';
import { advanceEnroutePhase, isEnroutePhase } from './phases/EnroutePhase';
import { advanceLandingPhase, isLandingPhase } from './phases/LandingPhase';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Target frame rate for simulation updates */
const TARGET_FPS = 60;
const FRAME_TIME_MS = 1000 / TARGET_FPS;

/** Simulation time scale (how many simulated seconds per real second at 1x speed) */
const TIME_SCALE = 60;  // 1 real second = 1 simulated minute

// ============================================================================
// PHASE ADVANCE DISPATCHER
// ============================================================================

/**
 * Advance the simulation by one time step.
 * 
 * Dispatches to the appropriate phase handler based on current phase.
 */
function advanceState(
  state: PhaseState,
  snapshot: SimulationSnapshot,
  deltaTimeSec: number
): PhaseState {
  // Check if paused or complete
  if (!state.isPlaying || state.isPaused || state.phase === 'COMPLETE') {
    return state;
  }
  
  // Scale delta time by playback speed and time scale
  const scaledDeltaTime = deltaTimeSec * state.playbackSpeed * TIME_SCALE;
  
  // Dispatch to appropriate phase handler
  if (isTakeoffPhase(state.phase)) {
    const result = advanceTakeoffPhase(state, snapshot, scaledDeltaTime);
    if (result) return result;
  }
  
  if (isEnroutePhase(state.phase)) {
    const result = advanceEnroutePhase(state, snapshot, scaledDeltaTime);
    if (result) return result;
  }
  
  if (isLandingPhase(state.phase)) {
    const result = advanceLandingPhase(state, snapshot, scaledDeltaTime);
    if (result) return result;
  }
  
  // Unknown phase - shouldn't happen
  console.warn(`Unknown phase: ${state.phase}`);
  return state;
}

// ============================================================================
// PLAYBACK CONTROL
// ============================================================================

/**
 * Start playback from LINEUP phase.
 */
function startPlayback(state: PhaseState): PhaseState {
  if (state.phase !== 'LINEUP') {
    // Already started, just resume
    return { ...state, isPlaying: true, isPaused: false };
  }
  
  // Transition from LINEUP to TAKEOFF_ROLL
  return {
    ...state,
    phase: 'TAKEOFF_ROLL',
    isPlaying: true,
    isPaused: false,
    phaseElapsedSec: 0,
  };
}

/**
 * Pause playback.
 */
function pausePlayback(state: PhaseState): PhaseState {
  return { ...state, isPaused: true };
}

/**
 * Resume from pause.
 */
function resumePlayback(state: PhaseState): PhaseState {
  return { ...state, isPaused: false };
}

/**
 * Stop playback and reset.
 */
function stopPlayback(_state: PhaseState, snapshot: SimulationSnapshot): PhaseState {
  return createInitialPhaseState(snapshot);
}

/**
 * Set playback speed.
 */
function setPlaybackSpeed(state: PhaseState, speed: number): PhaseState {
  return { ...state, playbackSpeed: Math.max(0.25, Math.min(4, speed)) };
}

// ============================================================================
// REACT HOOK
// ============================================================================

export interface UsePhaseSimulationResult {
  /** Current simulation state */
  state: PhaseState;
  
  /** Read-only output for map */
  output: SimulationOutput;
  
  /** Whether simulation is ready (snapshot loaded) */
  isReady: boolean;
  
  /** Start/resume simulation */
  play: () => void;
  
  /** Pause simulation */
  pause: () => void;
  
  /** Stop and reset simulation */
  stop: () => void;
  
  /** Set playback speed (0.25 to 4) */
  setSpeed: (speed: number) => void;
  
  /** Load a new snapshot (resets simulation) */
  loadSnapshot: (snapshot: SimulationSnapshot) => void;
}

/**
 * React hook for phase-based simulation.
 * 
 * This is the ONLY interface between simulation and React components.
 */
export function usePhaseSimulation(): UsePhaseSimulationResult {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [state, setState] = useState<PhaseState | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  // Animation loop
  useEffect(() => {
    if (!snapshot || !state || !state.isPlaying || state.isPaused) {
      return;
    }
    
    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTimeMs = currentTime - lastTimeRef.current;
      
      // Only update at target framerate
      if (deltaTimeMs >= FRAME_TIME_MS) {
        const deltaTimeSec = deltaTimeMs / 1000;
        
        setState(prevState => {
          if (!prevState) return prevState;
          return advanceState(prevState, snapshot, deltaTimeSec);
        });
        
        lastTimeRef.current = currentTime;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [snapshot, state?.isPlaying, state?.isPaused]);
  
  // Handlers
  const play = useCallback(() => {
    setState(prevState => {
      if (!prevState) return prevState;
      return startPlayback(prevState);
    });
  }, []);
  
  const pause = useCallback(() => {
    setState(prevState => {
      if (!prevState) return prevState;
      if (prevState.isPaused) {
        return resumePlayback(prevState);
      }
      return pausePlayback(prevState);
    });
  }, []);
  
  const stop = useCallback(() => {
    if (!snapshot) return;
    setState(stopPlayback(state!, snapshot));
  }, [snapshot, state]);
  
  const setSpeed = useCallback((speed: number) => {
    setState(prevState => {
      if (!prevState) return prevState;
      return setPlaybackSpeed(prevState, speed);
    });
  }, []);
  
  const loadSnapshot = useCallback((newSnapshot: SimulationSnapshot) => {
    setSnapshot(newSnapshot);
    setState(createInitialPhaseState(newSnapshot));
    lastTimeRef.current = 0;
  }, []);
  
  // Default state when no snapshot
  const defaultState: PhaseState = {
    phase: 'LINEUP',
    distanceAlongRunwayFt: 0,
    distanceAlongRouteNm: 0,
    currentWaypointIndex: 0,
    position: { lat: 0, lon: 0 },
    headingTrue: 0,
    pitchDeg: 0,
    bankDeg: 0,
    indicatedAirspeedKts: 0,
    groundSpeedKts: 0,
    altitudeFt: 0,
    verticalSpeedFpm: 0,
    phaseElapsedSec: 0,
    totalElapsedSec: 0,
    isPlaying: false,
    isPaused: false,
    playbackSpeed: 1,
  };
  
  const currentState = state || defaultState;
  
  return {
    state: currentState,
    output: toSimulationOutput(currentState),
    isReady: snapshot !== null && state !== null,
    play,
    pause,
    stop,
    setSpeed,
    loadSnapshot,
  };
}

// ============================================================================
// PHASE UTILITIES
// ============================================================================

/**
 * Get human-readable phase name.
 */
export function getPhaseName(phase: FlightPhase): string {
  const names: Record<FlightPhase, string> = {
    LINEUP: 'Lined Up',
    TAKEOFF_ROLL: 'Takeoff Roll',
    V1: 'V1 - Decision',
    ROTATE: 'Rotating',
    LIFTOFF: 'Liftoff',
    INITIAL_CLIMB: 'Initial Climb',
    CLIMB: 'Climbing',
    CRUISE: 'Cruise',
    DESCENT: 'Descending',
    APPROACH: 'Approach',
    FINAL: 'Final Approach',
    LANDING: 'Landing',
    TAXI_IN: 'Taxi In',
    COMPLETE: 'Complete',
  };
  return names[phase] || phase;
}

/**
 * Get phase category.
 */
export function getPhaseCategory(phase: FlightPhase): 'ground' | 'departure' | 'enroute' | 'arrival' {
  if (['LINEUP', 'TAKEOFF_ROLL', 'V1', 'ROTATE'].includes(phase)) return 'ground';
  if (['LIFTOFF', 'INITIAL_CLIMB'].includes(phase)) return 'departure';
  if (['CLIMB', 'CRUISE', 'DESCENT'].includes(phase)) return 'enroute';
  return 'arrival';
}
