/**
 * Enhanced Animation Hook
 * 
 * Uses the FlightSimulation system for accurate aircraft movement.
 * Provides smooth animation with proper phase progression.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { Coordinate, FlightPlan, AnimationState, Wind } from '@/types';
import { EnhancedAircraft } from '@/types/aircraft';
import { 
  FlightSimulation, 
  SimulationState, 
  FlightPhase,
  createFlightSimulation,
} from '@/simulation/FlightSimulation';

// ============================================================================
// TYPES
// ============================================================================

interface UseEnhancedAnimationOptions {
  flightPlan: FlightPlan | null;
  aircraft: EnhancedAircraft | null;
  animationState: AnimationState;
  wind: Wind | null;
  onStateUpdate: (state: SimulationState) => void;
  onProgressUpdate: (progress: number, legIndex: number) => void;
  onPhaseChange: (phase: FlightPhase) => void;
  onComplete: () => void;
}

interface UseEnhancedAnimationReturn {
  simulation: FlightSimulation | null;
  updatePositionAtProgress: (progress: number) => void;
  getInitialPosition: () => Coordinate | null;
  getCurrentState: () => SimulationState | null;
  getTotalTime: () => number;
  getTotalDistance: () => number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useEnhancedAnimation({
  flightPlan,
  aircraft,
  animationState,
  wind,
  onStateUpdate,
  onProgressUpdate,
  onPhaseChange,
  onComplete,
}: UseEnhancedAnimationOptions): UseEnhancedAnimationReturn {
  // Refs for animation
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastPhaseRef = useRef<FlightPhase | null>(null);
  const simulationRef = useRef<FlightSimulation | null>(null);
  
  // Create/update simulation when flight plan or aircraft changes
  useEffect(() => {
    if (!flightPlan || !aircraft) {
      simulationRef.current = null;
      return;
    }
    
    simulationRef.current = createFlightSimulation(
      flightPlan,
      aircraft,
      wind,
      animationState.speed
    );
    
    // Reset to initial state
    const initialState = simulationRef.current.getState();
    onStateUpdate(initialState);
    onProgressUpdate(0, 0);
    
  }, [flightPlan, aircraft, wind]);
  
  // Update speed multiplier when it changes
  useEffect(() => {
    if (simulationRef.current && flightPlan && aircraft) {
      // Recreate with new speed
      const currentProgress = simulationRef.current.getState().totalProgress;
      simulationRef.current = createFlightSimulation(
        flightPlan,
        aircraft,
        wind,
        animationState.speed
      );
      simulationRef.current.setProgress(currentProgress);
    }
  }, [animationState.speed]);
  
  // Animation frame callback
  const animate = useCallback((timestamp: number) => {
    if (!animationState.isPlaying || animationState.isPaused || !simulationRef.current) {
      frameRef.current = null;
      return;
    }
    
    // Calculate delta time
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }
    const deltaMs = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Update simulation
    const deltaSeconds = deltaMs / 1000;
    const state = simulationRef.current.update(deltaSeconds);
    
    // Emit updates
    onStateUpdate(state);
    onProgressUpdate(state.totalProgress, state.currentLegIndex);
    
    // Check for phase change
    if (state.phase !== lastPhaseRef.current) {
      lastPhaseRef.current = state.phase;
      onPhaseChange(state.phase);
    }
    
    // Check if complete
    if (simulationRef.current.isComplete()) {
      onComplete();
      frameRef.current = null;
      return;
    }
    
    // Continue animation
    frameRef.current = requestAnimationFrame(animate);
  }, [
    animationState.isPlaying,
    animationState.isPaused,
    onStateUpdate,
    onProgressUpdate,
    onPhaseChange,
    onComplete,
  ]);
  
  // Start/stop animation based on state
  useEffect(() => {
    if (animationState.isPlaying && !animationState.isPaused && simulationRef.current) {
      lastTimeRef.current = 0;
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    }
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animationState.isPlaying, animationState.isPaused, animate]);
  
  // Sync progress when manually changed (scrubbing)
  useEffect(() => {
    if (simulationRef.current && !animationState.isPlaying) {
      const state = simulationRef.current.setProgress(animationState.progress);
      onStateUpdate(state);
      onProgressUpdate(state.totalProgress, state.currentLegIndex);
    }
  }, [animationState.progress, animationState.isPlaying]);
  
  // Update position at specific progress
  const updatePositionAtProgress = useCallback((progress: number) => {
    if (!simulationRef.current) return;
    
    const state = simulationRef.current.setProgress(progress);
    onStateUpdate(state);
    onProgressUpdate(state.totalProgress, state.currentLegIndex);
  }, [onStateUpdate, onProgressUpdate]);
  
  // Get initial position
  const getInitialPosition = useCallback((): Coordinate | null => {
    if (!flightPlan) return null;
    return {
      lat: flightPlan.departure.position.lat,
      lon: flightPlan.departure.position.lon,
    };
  }, [flightPlan]);
  
  // Get current state
  const getCurrentState = useCallback((): SimulationState | null => {
    return simulationRef.current?.getState() || null;
  }, []);
  
  // Get total time
  const getTotalTime = useCallback((): number => {
    return simulationRef.current?.getTotalTime() || 0;
  }, []);
  
  // Get total distance
  const getTotalDistance = useCallback((): number => {
    return simulationRef.current?.getTotalDistance() || 0;
  }, []);
  
  return {
    simulation: simulationRef.current,
    updatePositionAtProgress,
    getInitialPosition,
    getCurrentState,
    getTotalTime,
    getTotalDistance,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY HOOK
// ============================================================================

/**
 * Legacy hook interface for backward compatibility
 */
export function useAnimationLegacy({
  flightPlan,
  animationState,
  wind,
  onPositionUpdate,
  onProgressUpdate,
  onComplete,
}: {
  flightPlan: FlightPlan | null;
  animationState: AnimationState;
  wind: { direction: number; speed: number } | null;
  onPositionUpdate: (position: Coordinate, heading: number, groundSpeed: number, altitude: number) => void;
  onProgressUpdate: (progress: number, legIndex: number) => void;
  onComplete: () => void;
}) {
  // Use a simple aircraft profile if none provided
  const [simpleAircraft] = useState<EnhancedAircraft | null>(() => {
    // Default aircraft for legacy compatibility
    return {
      icaoCode: 'B738',
      name: 'Boeing 737-800',
      manufacturer: 'Boeing',
      model: '737-800',
      wakeTurbulenceCategory: 'M',
      approachCategory: 'C',
      engineType: 'JET',
      engineCount: 2,
      weightClass: 'MEDIUM',
      speeds: {
        v1: 145,
        vR: 150,
        v2: 155,
        climbSpeed: 280,
        cruiseSpeed: 450,
        descentSpeed: 290,
        vRef: 135,
        vApp: 140,
        vmo: 340,
        mmo: 0.82,
        stallSpeedClean: 112,
        stallSpeedLanding: 100,
      },
      runwayRequirements: {
        minTakeoffRunway: 2300,
        takeoffDistance: 2300,
        takeoffDistanceFactorPerC: 1.3,
        takeoffDistanceFactorPer1000ft: 8,
        minLandingRunway: 1630,
        landingDistance: 1630,
        landingDistanceWet: 1955,
        minRunwayWidth: 30,
        allowedSurfaces: ['ASP', 'CON', 'PEM', 'BIT'],
        requiresPavedRunway: true,
      },
      windLimitations: {
        maxCrosswind: 36,
        maxCrosswindWet: 27,
        maxTailwind: 15,
        maxHeadwind: 999,
        gustFactor: 1.0,
      },
      climbDescent: {
        initialClimbRate: 2500,
        cruiseClimbRate: 950,
        climbGradient: 4.0,
        timeToFL350: 23,
        normalDescentRate: 1800,
        maxDescentRate: 4000,
        descentGradient: 3.0,
        descentDistanceFactor: 3.0,
      },
      altitude: {
        serviceCeiling: 41000,
        optimalCruiseAltitude: 37000,
        maxTakeoffAltitude: 9500,
        maxLandingAltitude: 9500,
        pressurizedCabin: true,
      },
      fuel: {
        capacity: 20894,
        maxRange: 2935,
        cruiseFuelBurn: 2600,
        climbFuelBurn: 3700,
        descentFuelBurn: 1400,
        taxiFuelBurn: 400,
        reserveMinutes: 45,
        alternateMinutes: 30,
      },
      weights: {
        oew: 41413,
        mtow: 79016,
        mlw: 65317,
        mzfw: 61689,
        maxPayload: 20276,
      },
      dimensions: {
        wingspan: 35.8,
        length: 39.5,
        height: 12.6,
        wheelbase: 12.4,
      },
      crewRequired: 2,
      maxPassengers: 189,
      isValidated: true,
      dataSource: 'Default',
    } as EnhancedAircraft;
  });
  
  const convertedWind: Wind | null = wind ? {
    direction: wind.direction,
    speed: wind.speed,
  } : null;
  
  const { updatePositionAtProgress, getInitialPosition } = useEnhancedAnimation({
    flightPlan,
    aircraft: simpleAircraft,
    animationState,
    wind: convertedWind,
    onStateUpdate: (state) => {
      onPositionUpdate(
        state.position,
        state.heading,
        state.groundSpeed,
        state.altitude
      );
    },
    onProgressUpdate,
    onPhaseChange: () => {},
    onComplete,
  });
  
  return {
    updatePositionAtProgress,
    getInitialPosition,
    getPositionAtProgress: () => null,
  };
}

/**
 * Extract wind from METAR for animation
 */
export function extractWindFromMetar(metar: { wind?: Wind } | null): Wind | null {
  if (!metar || !metar.wind) return null;
  return metar.wind;
}
