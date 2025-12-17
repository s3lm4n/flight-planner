/**
 * Simple Simulation Hook
 * 
 * A straightforward React hook for the flight simulation.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FlightPlan, FlightLeg, Coordinate } from '@/types';
import { 
  SimpleSimulation, 
  SimulationState, 
  FlightPhase,
  formatFlightPhase,
  getSimpleSimulation,
} from '@/simulation/SimpleSimulation';

export { formatFlightPhase } from '@/simulation/SimpleSimulation';
export type { FlightPhase } from '@/simulation/SimpleSimulation';

export interface UseSimpleSimulationOptions {
  flightPlan: FlightPlan | null;
  onComplete?: () => void;
  onPhaseChange?: (phase: FlightPhase, prevPhase: FlightPhase) => void;
  onLegChange?: (legIndex: number, leg: FlightLeg) => void;
}

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
  phase: 'PREFLIGHT',
  isRunning: false,
  isPaused: false,
  isComplete: false,
};

export function useSimpleSimulation({
  flightPlan,
  onComplete,
  onPhaseChange,
  onLegChange,
}: UseSimpleSimulationOptions) {
  const simRef = useRef<SimpleSimulation>(getSimpleSimulation());
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  const [speed, setSpeedState] = useState<number>(1);

  // Store callbacks in refs
  const onCompleteRef = useRef(onComplete);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onLegChangeRef = useRef(onLegChange);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPhaseChangeRef.current = onPhaseChange;
    onLegChangeRef.current = onLegChange;
  }, [onComplete, onPhaseChange, onLegChange]);

  // Initialize when flight plan changes
  useEffect(() => {
    const sim = simRef.current;

    if (!flightPlan) {
      sim.stop();
      setState(INITIAL_STATE);
      return;
    }

    sim.initialize(flightPlan, {
      onStateUpdate: (newState) => {
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

    setState(sim.getState());

    return () => {
      sim.stop();
    };
  }, [flightPlan]);

  // Control methods
  const play = useCallback(() => {
    simRef.current.play();
  }, []);

  const pause = useCallback(() => {
    simRef.current.pause();
  }, []);

  const stop = useCallback(() => {
    simRef.current.stop();
  }, []);

  const reset = useCallback(() => {
    simRef.current.reset();
  }, []);

  const seekTo = useCallback((progress: number) => {
    simRef.current.seekToProgress(progress);
  }, []);

  const setSpeed = useCallback((scale: number) => {
    simRef.current.setTimeScale(scale);
    setSpeedState(scale);
  }, []);

  // Computed values
  const position = useMemo((): Coordinate | null => {
    if (state.position.lat === 0 && state.position.lon === 0) {
      return flightPlan?.departure.position || null;
    }
    return state.position;
  }, [state.position, flightPlan]);

  const phaseLabel = useMemo(() => formatFlightPhase(state.phase), [state.phase]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedTimeFormatted = useMemo(() => formatTime(state.elapsedTime), [state.elapsedTime]);
  const etaFormatted = useMemo(() => formatTime(state.estimatedTimeRemaining), [state.estimatedTimeRemaining]);

  return {
    state,
    position,
    heading: state.heading,
    altitude: state.altitude,
    groundSpeed: state.groundSpeed,
    progress: state.progress,
    phase: state.phase,
    phaseLabel,
    currentLegIndex: state.currentLegIndex,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    isComplete: state.isComplete,
    elapsedTime: state.elapsedTime,
    estimatedTimeRemaining: state.estimatedTimeRemaining,
    elapsedTimeFormatted,
    etaFormatted,
    distanceCovered: state.distanceCovered,
    distanceRemaining: state.distanceRemaining,
    play,
    pause,
    stop,
    reset,
    seekTo,
    setSpeed,
    speed,
  };
}
