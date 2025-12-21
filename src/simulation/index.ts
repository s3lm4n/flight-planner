/**
 * Simulation barrel export
 */
export * from './FlightSimulation';
// SimulationEngine has duplicate exports with FlightSimulation
export { SimulationEngine } from './SimulationEngine';

// Runway-based simulation (PREFERRED for realistic operations)
// This is the CORRECT simulation that:
// - Starts from runway threshold
// - Uses runway heading
// - Follows runway centerline during takeoff roll
export {
  RunwayBasedSimulation,
  useRunwaySimulation,
  type SimulationState,
  type FlightPhase,
  type UseRunwaySimulationOptions,
  type UseRunwaySimulationReturn,
  type SimulationCallbacks,
} from './RunwayBasedSimulation';
// ============================================================================
// FS2024-STYLE PHASE-BASED SIMULATION (NEW ARCHITECTURE)
// ============================================================================

export { createSimulationSnapshot, validatePlanningState } from './SimulationSnapshot';
export { 
  usePhaseSimulation, 
  getPhaseName, 
  type UsePhaseSimulationResult 
} from './PhaseStateMachine';

// Phase modules (usually used internally, but exported for advanced use)
export * from './phases/TakeoffPhase';
export * from './phases/EnroutePhase';
export * from './phases/LandingPhase';