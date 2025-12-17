/**
 * Hooks Barrel Export
 */

export { useAnimation, extractWindFromMetar } from './useAnimation';
export { useEnhancedAnimation, useAnimationLegacy, extractWindFromMetar as extractWind } from './useEnhancedAnimation';

// New simulation hook with proper delta time (legacy)
export { 
  useFlightSimulation, 
  extractWindFromMetar as extractSimulationWind,
  formatPhase,
  getPhaseColor,
  type FlightPhase,
  type SimulationState,
} from './useFlightSimulation';

// Fixed real-time simulation hook
export {
  useSimulation,
  type UseSimulationOptions,
  type UseSimulationReturn,
  FlightPhase as SimulationPhase,
  formatFlightPhase,
} from './useSimulation';
