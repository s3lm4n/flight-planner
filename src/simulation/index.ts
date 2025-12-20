/**
 * Simulation barrel export
 */
export * from './FlightSimulation';
// SimulationEngine has duplicate exports with FlightSimulation
export { SimulationEngine } from './SimulationEngine';

// Runway-based simulation (preferred for realistic operations)
// Selective exports to avoid conflicts with FlightSimulation
export {
  RunwayBasedSimulation,
  useRunwaySimulation,
  type UseRunwaySimulationOptions,
  type UseRunwaySimulationReturn,
  type SimulationCallbacks,
} from './RunwayBasedSimulation';
