/**
 * Dispatcher Store
 * 
 * Central state management for runway and dispatch decisions.
 * This store is the SINGLE SOURCE OF TRUTH for:
 * - Selected departure runway
 * - Selected arrival runway
 * - Current dispatch status
 * - Weather data
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Runway, SelectedRunway, calculateRunwayWindComponents, selectBestRunway } from '@/types/runway';
import { getAirportRunways } from '@/data/runwayDatabase';
import { Coordinate } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DispatchWeather {
  windDirection: number | 'VRB';
  windSpeed: number;
  windGust?: number;
  visibility: number;  // statute miles
  ceiling?: number;    // feet AGL
  temperature: number; // Celsius
  altimeter: number;   // inHg
  category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  raw?: string;        // Raw METAR
  isLive: boolean;     // True if from API, false if simulated
}

export interface DispatchStatus {
  canDispatch: boolean;
  decision: 'GO' | 'NO-GO' | 'CONDITIONAL' | 'PENDING';
  
  // Issues
  criticalIssues: string[];
  warnings: string[];
  
  // Component status
  runwayStatus: {
    departureOk: boolean;
    arrivalOk: boolean;
    departureIssue?: string;
    arrivalIssue?: string;
  };
  
  weatherStatus: {
    departureOk: boolean;
    arrivalOk: boolean;
    departureIssue?: string;
    arrivalIssue?: string;
  };
  
  performanceStatus: {
    rangeOk: boolean;
    fuelOk: boolean;
    weightOk: boolean;
    issues: string[];
  };
}

export interface DispatcherState {
  // Departure
  departureIcao: string | null;
  departureRunways: Runway[];
  departureSelectedRunway: SelectedRunway | null;
  departureWeather: DispatchWeather | null;
  
  // Arrival
  arrivalIcao: string | null;
  arrivalRunways: Runway[];
  arrivalSelectedRunway: SelectedRunway | null;
  arrivalWeather: DispatchWeather | null;
  
  // Overall status
  dispatchStatus: DispatchStatus;
  
  // Actions
  setDepartureAirport: (icao: string, position: Coordinate, elevation: number) => void;
  setArrivalAirport: (icao: string, position: Coordinate, elevation: number) => void;
  setDepartureRunway: (designator: string) => void;
  setArrivalRunway: (designator: string) => void;
  setDepartureWeather: (weather: DispatchWeather) => void;
  setArrivalWeather: (weather: DispatchWeather) => void;
  autoSelectRunways: (maxCrosswind: number, maxTailwind: number, requiredLength: number) => void;
  updateDispatchStatus: (status: Partial<DispatchStatus>) => void;
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialDispatchStatus: DispatchStatus = {
  canDispatch: false,
  decision: 'PENDING',
  criticalIssues: [],
  warnings: [],
  runwayStatus: {
    departureOk: false,
    arrivalOk: false,
  },
  weatherStatus: {
    departureOk: true,
    arrivalOk: true,
  },
  performanceStatus: {
    rangeOk: true,
    fuelOk: true,
    weightOk: true,
    issues: [],
  },
};

// ============================================================================
// STORE
// ============================================================================

export const useDispatcherStore = create<DispatcherState>()(
  devtools(
    (set, get) => ({
      // Initial state
      departureIcao: null,
      departureRunways: [],
      departureSelectedRunway: null,
      departureWeather: null,
      
      arrivalIcao: null,
      arrivalRunways: [],
      arrivalSelectedRunway: null,
      arrivalWeather: null,
      
      dispatchStatus: initialDispatchStatus,

      // Set departure airport
      setDepartureAirport: (icao, _position, _elevation) => {
        const runways = getAirportRunways(icao);
        
        set({
          departureIcao: icao,
          departureRunways: runways,
          departureSelectedRunway: null,
          dispatchStatus: {
            ...get().dispatchStatus,
            runwayStatus: {
              ...get().dispatchStatus.runwayStatus,
              departureOk: false,
              departureIssue: runways.length === 0 ? `No runway data for ${icao}` : undefined,
            },
          },
        });
      },

      // Set arrival airport
      setArrivalAirport: (icao, _position, _elevation) => {
        const runways = getAirportRunways(icao);
        
        set({
          arrivalIcao: icao,
          arrivalRunways: runways,
          arrivalSelectedRunway: null,
          dispatchStatus: {
            ...get().dispatchStatus,
            runwayStatus: {
              ...get().dispatchStatus.runwayStatus,
              arrivalOk: false,
              arrivalIssue: runways.length === 0 ? `No runway data for ${icao}` : undefined,
            },
          },
        });
      },

      // Manually select departure runway
      setDepartureRunway: (designator) => {
        const state = get();
        const runway = state.departureRunways.find(
          r => r.ends.some(e => e.designator === designator)
        );
        
        if (!runway) return;
        
        const end = runway.ends.find(e => e.designator === designator)!;
        const weather = state.departureWeather;
        
        const windComponents = weather
          ? calculateRunwayWindComponents(end.heading, weather.windDirection, weather.windSpeed)
          : { headwind: 0, crosswind: 0, tailwind: 0 };
        
        set({
          departureSelectedRunway: {
            designator,
            runway,
            end,
            windComponents,
            isSuitable: true, // Manual selection - user takes responsibility
            issues: [],
            isPreferred: true,
          },
          dispatchStatus: {
            ...state.dispatchStatus,
            runwayStatus: {
              ...state.dispatchStatus.runwayStatus,
              departureOk: true,
              departureIssue: undefined,
            },
          },
        });
      },

      // Manually select arrival runway
      setArrivalRunway: (designator) => {
        const state = get();
        const runway = state.arrivalRunways.find(
          r => r.ends.some(e => e.designator === designator)
        );
        
        if (!runway) return;
        
        const end = runway.ends.find(e => e.designator === designator)!;
        const weather = state.arrivalWeather;
        
        const windComponents = weather
          ? calculateRunwayWindComponents(end.heading, weather.windDirection, weather.windSpeed)
          : { headwind: 0, crosswind: 0, tailwind: 0 };
        
        set({
          arrivalSelectedRunway: {
            designator,
            runway,
            end,
            windComponents,
            isSuitable: true,
            issues: [],
            isPreferred: true,
          },
          dispatchStatus: {
            ...state.dispatchStatus,
            runwayStatus: {
              ...state.dispatchStatus.runwayStatus,
              arrivalOk: true,
              arrivalIssue: undefined,
            },
          },
        });
      },

      // Set departure weather
      setDepartureWeather: (weather) => {
        set({ departureWeather: weather });
        
        // Re-evaluate selected runway with new wind
        const state = get();
        if (state.departureSelectedRunway) {
          const windComponents = calculateRunwayWindComponents(
            state.departureSelectedRunway.end.heading,
            weather.windDirection,
            weather.windSpeed
          );
          
          set({
            departureSelectedRunway: {
              ...state.departureSelectedRunway,
              windComponents,
            },
          });
        }
      },

      // Set arrival weather
      setArrivalWeather: (weather) => {
        set({ arrivalWeather: weather });
        
        // Re-evaluate selected runway with new wind
        const state = get();
        if (state.arrivalSelectedRunway) {
          const windComponents = calculateRunwayWindComponents(
            state.arrivalSelectedRunway.end.heading,
            weather.windDirection,
            weather.windSpeed
          );
          
          set({
            arrivalSelectedRunway: {
              ...state.arrivalSelectedRunway,
              windComponents,
            },
          });
        }
      },

      // Auto-select best runways based on wind
      autoSelectRunways: (maxCrosswind, maxTailwind, requiredLength) => {
        const state = get();
        const updates: Partial<DispatcherState> = {};
        
        // Departure
        if (state.departureRunways.length > 0 && state.departureWeather) {
          const best = selectBestRunway(
            state.departureRunways,
            state.departureWeather.windDirection,
            state.departureWeather.windSpeed,
            requiredLength,
            maxCrosswind,
            maxTailwind
          );
          
          if (best) {
            updates.departureSelectedRunway = best;
          }
        }
        
        // Arrival
        if (state.arrivalRunways.length > 0 && state.arrivalWeather) {
          const best = selectBestRunway(
            state.arrivalRunways,
            state.arrivalWeather.windDirection,
            state.arrivalWeather.windSpeed,
            requiredLength, // Landing distance typically less, but use same for safety
            maxCrosswind,
            maxTailwind
          );
          
          if (best) {
            updates.arrivalSelectedRunway = best;
          }
        }
        
        // Update status
        updates.dispatchStatus = {
          ...state.dispatchStatus,
          runwayStatus: {
            departureOk: !!updates.departureSelectedRunway?.isSuitable,
            arrivalOk: !!updates.arrivalSelectedRunway?.isSuitable,
            departureIssue: updates.departureSelectedRunway?.issues.join('; '),
            arrivalIssue: updates.arrivalSelectedRunway?.issues.join('; '),
          },
        };
        
        set(updates);
      },

      // Update dispatch status
      updateDispatchStatus: (status) => {
        set({
          dispatchStatus: {
            ...get().dispatchStatus,
            ...status,
          },
        });
      },

      // Reset all state
      reset: () => {
        set({
          departureIcao: null,
          departureRunways: [],
          departureSelectedRunway: null,
          departureWeather: null,
          arrivalIcao: null,
          arrivalRunways: [],
          arrivalSelectedRunway: null,
          arrivalWeather: null,
          dispatchStatus: initialDispatchStatus,
        });
      },
    }),
    { name: 'dispatcher-store' }
  )
);

// ============================================================================
// SELECTORS (for convenience)
// ============================================================================

/**
 * Get departure threshold position (for simulation start)
 */
export function getDepartureThreshold(state: DispatcherState): Coordinate | null {
  if (!state.departureSelectedRunway) return null;
  return state.departureSelectedRunway.end.threshold;
}

/**
 * Get departure runway heading (for simulation initial heading)
 */
export function getDepartureHeading(state: DispatcherState): number | null {
  if (!state.departureSelectedRunway) return null;
  return state.departureSelectedRunway.end.heading;
}

/**
 * Get arrival threshold position
 */
export function getArrivalThreshold(state: DispatcherState): Coordinate | null {
  if (!state.arrivalSelectedRunway) return null;
  return state.arrivalSelectedRunway.end.threshold;
}

/**
 * Get arrival runway heading (for final approach)
 */
export function getArrivalHeading(state: DispatcherState): number | null {
  if (!state.arrivalSelectedRunway) return null;
  return state.arrivalSelectedRunway.end.heading;
}
