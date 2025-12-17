/**
 * React Hook for Flight Simulation
 * 
 * This hook provides a React-friendly interface to the SimulationEngine.
 * 
 * CRITICAL: The simulation engine runs OUTSIDE of React's render cycle.
 * This hook only observes the engine state and provides control methods.
 * 
 * The engine uses requestAnimationFrame and deltaTime-based movement,
 * ensuring smooth real-time animation regardless of React re-renders.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FlightPlan, FlightLeg, Coordinate } from '@/types';
import { 
  SimulationEngine, 
  SimulationState, 
  FlightPhase,
  formatFlightPhase,
  getSimulationEngine,
} from '@/simulation/SimulationEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSimulationOptions {
  flightPlan: FlightPlan | null;
  onComplete?: () => void;
  onPhaseChange?: (phase: FlightPhase, prevPhase: FlightPhase) => void;
  onLegChange?: (legIndex: number, leg: FlightLeg) => void;
}

export interface UseSimulationReturn {
  // State
  state: SimulationState;
  
  // Computed values
  position: Coordinate | null;
  heading: number;
  altitude: number;
  groundSpeed: number;
  progress: number;
  phase: FlightPhase;
  phaseLabel: string;
  currentLegIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  
  // Time values
  elapsedTime: number;
  estimatedTimeRemaining: number;
  elapsedTimeFormatted: string;
  etaFormatted: string;
  
  // Distance values
  distanceCovered: number;
  distanceRemaining: number;
  
  // Controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  seekTo: (progress: number) => void;
  setSpeed: (scale: number) => void;
  speed: number;
}

// Initial state when no flight plan is loaded
const INITIAL_STATE: SimulationState = {
  position: { lat: 0, lon: 0 },
  heading: 0,
  altitude: 0,
  groundSpeed: 0,
  progress: 0,
  distanceCovered: 0,
  distanceRemaining: 0,
  currentLegIndex: 0,
  legProgress: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
  phase: 'PREFLIGHT' as FlightPhase,
  isRunning: false,
  isPaused: false,
  isComplete: false,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSimulation({
  flightPlan,
  onComplete,
  onPhaseChange,
  onLegChange,
}: UseSimulationOptions): UseSimulationReturn {
  // Get or create the simulation engine (singleton)
  const engineRef = useRef<SimulationEngine>(getSimulationEngine());
  
  // Local state that mirrors the engine state
  // This is updated via callbacks from the engine
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  const [speed, setSpeedState] = useState<number>(1);
  
  // Store callbacks in refs to avoid stale closures
  const onCompleteRef = useRef(onComplete);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onLegChangeRef = useRef(onLegChange);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPhaseChangeRef.current = onPhaseChange;
    onLegChangeRef.current = onLegChange;
  }, [onComplete, onPhaseChange, onLegChange]);
  
  // Initialize engine when flight plan changes
  useEffect(() => {
    const engine = engineRef.current;
    
    if (!flightPlan) {
      engine.stop();
      setState(INITIAL_STATE);
      return;
    }
    
    // Initialize engine with callbacks
    engine.initialize(flightPlan, {
      onStateUpdate: (newState) => {
        // This is called from requestAnimationFrame
        // React will batch these updates efficiently
        setState(newState);
      },
      onPhaseChange: (phase, prevPhase) => {
        onPhaseChangeRef.current?.(phase, prevPhase);
      },
      onLegChange: (legIndex, leg) => {
        onLegChangeRef.current?.(legIndex, leg);
      },
      onComplete: () => {
        onCompleteRef.current?.();
      },
    });
    
    // Get initial state
    setState(engine.getState());
    
    // Cleanup on unmount
    return () => {
      engine.stop();
    };
  }, [flightPlan]);
  
  // ============================================================================
  // CONTROL METHODS
  // ============================================================================
  
  const play = useCallback(() => {
    engineRef.current.play();
  }, []);
  
  const pause = useCallback(() => {
    engineRef.current.pause();
  }, []);
  
  const stop = useCallback(() => {
    engineRef.current.stop();
  }, []);
  
  const reset = useCallback(() => {
    engineRef.current.reset();
  }, []);
  
  const seekTo = useCallback((progress: number) => {
    engineRef.current.seekToProgress(progress);
  }, []);
  
  const setSpeed = useCallback((scale: number) => {
    engineRef.current.setTimeScale(scale);
    setSpeedState(scale);
  }, []);
  
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const position = useMemo((): Coordinate | null => {
    if (state.position.lat === 0 && state.position.lon === 0) {
      return flightPlan?.departure.position || null;
    }
    return state.position;
  }, [state.position, flightPlan]);
  
  const phaseLabel = useMemo(() => {
    return formatFlightPhase(state.phase);
  }, [state.phase]);
  
  const elapsedTimeFormatted = useMemo(() => {
    return formatDuration(state.elapsedTime);
  }, [state.elapsedTime]);
  
  const etaFormatted = useMemo(() => {
    return formatDuration(state.estimatedTimeRemaining);
  }, [state.estimatedTimeRemaining]);
  
  // ============================================================================
  // RETURN VALUE
  // ============================================================================
  
  return {
    // Raw state
    state,
    
    // Computed position values
    position,
    heading: state.heading,
    altitude: state.altitude,
    groundSpeed: state.groundSpeed,
    progress: state.progress,
    phase: state.phase,
    phaseLabel,
    currentLegIndex: state.currentLegIndex,
    
    // Status
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    isComplete: state.isComplete,
    
    // Time values
    elapsedTime: state.elapsedTime,
    estimatedTimeRemaining: state.estimatedTimeRemaining,
    elapsedTimeFormatted,
    etaFormatted,
    
    // Distance values
    distanceCovered: state.distanceCovered,
    distanceRemaining: state.distanceRemaining,
    
    // Controls
    play,
    pause,
    stop,
    reset,
    seekTo,
    setSpeed,
    speed,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format duration in seconds to human readable string
 */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Re-export types
export type { FlightPhase };
export { formatFlightPhase };
