/**
 * EFB Main Screen - FS2024-Style Dispatcher Interface
 * 
 * LAYOUT (3 columns):
 * - LEFT: Route selection, Aircraft, METAR/TAF, Dispatch Release
 * - CENTER: Interactive map with route geometry and simulation
 * - RIGHT: Flight plan summary, route legs, fuel/time
 * 
 * This is the OPERATIONAL view - no settings, no database config.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PassiveFlightMap } from '@/components/Map/PassiveFlightMap';
import { 
  airportDB, 
  CSVAirport,
} from '@/services/airports/airportParser';
import { RunwaySelector } from '@/components/UI/RunwaySelector';
import { Runway, SelectedRunway } from '@/types/runway';
import { getAirportRunways, hasRunwayData } from '@/data/runwayDatabase';
import { airports as builtInAirports } from '@/data/airports';
import { 
  generateFlightRouteWithRunways, 
  FlightRoute 
} from '@/services/route/runwayBasedRouteCalculator';
import { 
  createSimulationSnapshot, 
  PlanningStateForSnapshot 
} from '@/simulation/SimulationSnapshot';
import { usePhaseSimulation, getPhaseName } from '@/simulation/PhaseStateMachine';
import { SimulationSnapshot } from '@/types/simulation';
import { fetchMetar, fetchTaf, DecodedMetar, DecodedTaf } from '@/api/aviationWeather';
import {
  evaluateDispatch,
  DispatchResult,
  AIRCRAFT_PROFILES,
  AircraftProfile,
  getAircraftProfile,
} from '@/services/dispatch/dispatchEngine';

// ============================================================================
// TYPES
// ============================================================================

type AppMode = 'PLANNING' | 'SIMULATION';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: 'h-screen flex flex-col bg-slate-900 text-white overflow-hidden',
  header: 'h-12 bg-slate-800 border-b border-slate-700 flex items-center px-4 shrink-0',
  headerTitle: 'text-lg font-bold text-white',
  main: 'flex-1 flex overflow-hidden',
  leftPanel: 'w-80 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden',
  centerPanel: 'flex-1 flex flex-col overflow-hidden',
  rightPanel: 'w-96 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden',
  panelHeader: 'px-3 py-2 bg-slate-700 border-b border-slate-600 font-semibold text-sm',
  panelContent: 'flex-1 overflow-y-auto p-3 space-y-3',
  card: 'bg-slate-700/50 rounded p-3',
  cardTitle: 'text-xs font-semibold text-slate-400 uppercase mb-2',
  input: 'w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none',
  select: 'w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none',
  button: 'px-3 py-1.5 rounded text-sm font-medium transition-colors',
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700',
  buttonSuccess: 'bg-green-600 hover:bg-green-700',
  buttonDanger: 'bg-red-600 hover:bg-red-700',
  buttonDisabled: 'bg-slate-600 text-slate-400 cursor-not-allowed',
  label: 'text-xs text-slate-400 mb-1 block',
  badge: 'px-2 py-0.5 rounded text-xs font-medium',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRunwaysForAirport(icao: string): Runway[] {
  if (hasRunwayData(icao)) {
    return getAirportRunways(icao);
  }
  
  const builtIn = builtInAirports[icao];
  if (builtIn && builtIn.runways) {
    return builtIn.runways.map((rwy): Runway => ({
      id: rwy.id,
      length: rwy.length,
      width: rwy.width,
      surface: rwy.surface === 'ASPH' ? 'ASP' : rwy.surface === 'CONC' ? 'CON' : 'ASP',
      lighted: rwy.lighting || false,
      status: 'OPEN',
      ends: rwy.ends.map(end => ({
        designator: end.designator,
        heading: end.heading,
        trueHeading: end.heading,
        threshold: end.threshold,
        elevation: end.elevation,
        tora: end.tora || rwy.length,
        toda: end.toda || rwy.length,
        asda: end.asda || rwy.length,
        lda: end.lda || rwy.length,
        ils: end.ils ? {
          frequency: end.ils.frequency,
          course: end.ils.course,
          glideslope: end.ils.glideslope,
          category: (end.ils.categoryType as 'I' | 'II' | 'IIIA' | 'IIIB' | 'IIIC') || 'I',
        } : undefined,
        visualAids: true,
      })) as [any, any],
    }));
  }
  
  return [];
}

function formatFlightCategory(cat: string | null): { text: string; color: string } {
  switch (cat) {
    case 'VFR': return { text: 'VFR', color: 'bg-green-600' };
    case 'MVFR': return { text: 'MVFR', color: 'bg-blue-600' };
    case 'IFR': return { text: 'IFR', color: 'bg-red-600' };
    case 'LIFR': return { text: 'LIFR', color: 'bg-purple-600' };
    default: return { text: 'N/A', color: 'bg-slate-600' };
  }
}

function formatWind(metar: DecodedMetar | null): string {
  if (!metar) return '-';
  const dir = metar.wind.direction === 'VRB' ? 'VRB' : `${String(metar.wind.direction).padStart(3, '0')}`;
  const gust = metar.wind.gust ? `G${metar.wind.gust}` : '';
  return `${dir}/${metar.wind.speed}${gust}KT`;
}

// ============================================================================
// AIRPORT SELECTOR COMPONENT
// ============================================================================

interface AirportSelectorProps {
  value: string;
  onChange: (icao: string, airport: CSVAirport | null) => void;
  label: string;
  airportCount: number;
  disabled?: boolean;
}

function AirportSelector({ value, onChange, label, airportCount, disabled }: AirportSelectorProps) {
  const [search, setSearch] = useState(value);
  const [suggestions, setSuggestions] = useState<CSVAirport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search.length >= 2 && !disabled) {
      if (airportCount > 0) {
        setSuggestions(airportDB.search(search, 8));
      } else {
        const matches = Object.values(builtInAirports)
          .filter(apt => 
            apt.icao.includes(search.toUpperCase()) ||
            apt.name.toUpperCase().includes(search.toUpperCase())
          )
          .slice(0, 8)
          .map(apt => ({
            icao: apt.icao,
            name: apt.name,
            latitude: apt.position.lat,
            longitude: apt.position.lon,
            elevation: apt.elevation,
          }));
        setSuggestions(matches);
      }
    } else {
      setSuggestions([]);
    }
  }, [search, airportCount, disabled]);

  const handleSelect = (airport: CSVAirport) => {
    setSearch(airport.icao);
    onChange(airport.icao, airport);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSearch(val);
    setShowSuggestions(true);
    
    const csvAirport = airportDB.get(val);
    if (csvAirport) {
      onChange(val, csvAirport);
      return;
    }
    
    const builtIn = builtInAirports[val];
    if (builtIn) {
      onChange(val, {
        icao: builtIn.icao,
        name: builtIn.name,
        latitude: builtIn.position.lat,
        longitude: builtIn.position.lon,
        elevation: builtIn.elevation,
      });
    } else {
      onChange(val, null);
    }
  };

  return (
    <div className="relative">
      <label className={styles.label}>{label}</label>
      <input
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        disabled={disabled}
        className={styles.input}
        placeholder="ICAO"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-slate-700 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto mt-1">
          {suggestions.map(apt => (
            <li
              key={apt.icao}
              onClick={() => handleSelect(apt)}
              className="px-2 py-1.5 hover:bg-slate-600 cursor-pointer text-sm"
            >
              <span className="font-mono text-blue-400">{apt.icao}</span>
              <span className="text-slate-300 ml-2">{apt.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// METAR DISPLAY COMPONENT
// ============================================================================

interface MetarDisplayProps {
  icao: string;
  metar: DecodedMetar | null;
  taf: DecodedTaf | null;
  type: 'departure' | 'arrival';
}

function MetarDisplay({ icao, metar, taf, type }: MetarDisplayProps) {
  if (!icao) return null;
  
  const cat = metar ? formatFlightCategory(metar.flightCategory) : formatFlightCategory(null);
  
  return (
    <div className={styles.card}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono font-bold ${type === 'departure' ? 'text-green-400' : 'text-blue-400'}`}>
          {icao}
        </span>
        <span className={`${styles.badge} ${cat.color}`}>{cat.text}</span>
      </div>
      
      {metar ? (
        <>
          <div className="text-xs font-mono text-slate-300 mb-2 leading-relaxed break-all">
            {metar.raw}
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Wind</div>
              <div className="font-mono">{formatWind(metar)}</div>
            </div>
            <div>
              <div className="text-slate-500">Vis</div>
              <div className="font-mono">{metar.visibility.value}{metar.visibility.unit}</div>
            </div>
            <div>
              <div className="text-slate-500">Temp</div>
              <div className="font-mono">{metar.temperature}°C</div>
            </div>
            <div>
              <div className="text-slate-500">QNH</div>
              <div className="font-mono">{metar.altimeter.toFixed(2)}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-500">No METAR available</div>
      )}
      
      {taf && (
        <details className="mt-2">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
            TAF forecast
          </summary>
          <div className="text-xs font-mono text-slate-400 mt-1 break-all">
            {taf.raw.slice(0, 300)}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================================
// DISPATCH RELEASE COMPONENT
// ============================================================================

interface DispatchReleaseProps {
  result: DispatchResult | null;
  onStartSimulation: () => void;
  canStart: boolean;
  mode: AppMode;
}

function DispatchRelease({ result, onStartSimulation, canStart, mode }: DispatchReleaseProps) {
  if (!result) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>Dispatch Release</div>
        <div className="text-sm text-slate-500">
          Complete flight plan to see dispatch evaluation
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Dispatch Release</div>
      
      {/* Status indicator */}
      <div className={`p-3 rounded mb-3 ${result.feasible ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
        <div className={`text-lg font-bold ${result.feasible ? 'text-green-400' : 'text-red-400'}`}>
          {result.feasible ? '✓ FLIGHT FEASIBLE' : '✗ FLIGHT NOT FEASIBLE'}
        </div>
        {result.feasible && result.warnings.length > 0 && (
          <div className="text-xs text-yellow-400 mt-1">
            {result.warnings.length} warning(s)
          </div>
        )}
      </div>
      
      {/* Blocking reasons */}
      {result.reasons.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-red-400 font-semibold mb-1">Blocking Issues:</div>
          <ul className="text-xs text-red-300 space-y-0.5">
            {result.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-yellow-400 font-semibold mb-1">Warnings:</div>
          <ul className="text-xs text-yellow-300 space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Key values */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">TOW</div>
          <div className="font-mono">{result.computed.towKg.toLocaleString()} kg</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">LW</div>
          <div className="font-mono">{result.computed.lwKg.toLocaleString()} kg</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">Block Fuel</div>
          <div className="font-mono">{result.computed.blockFuelKg.toLocaleString()} kg</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">Flight Time</div>
          <div className="font-mono">{Math.floor(result.computed.flightTimeMin / 60)}h {result.computed.flightTimeMin % 60}m</div>
        </div>
      </div>
      
      {/* Start button */}
      {mode === 'PLANNING' && (
        <button
          onClick={onStartSimulation}
          disabled={!canStart || !result.feasible}
          className={`${styles.button} w-full ${canStart && result.feasible ? styles.buttonSuccess : styles.buttonDisabled}`}
        >
          {result.feasible ? 'Release Flight' : 'Cannot Release'}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// SIMULATION CONTROLS COMPONENT
// ============================================================================

interface SimulationControlsProps {
  simulation: ReturnType<typeof usePhaseSimulation>;
  onStop: () => void;
}

function SimulationControlsPanel({ simulation, onStop }: SimulationControlsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Simulation</div>
      
      {/* Phase */}
      <div className="bg-slate-700 p-3 rounded mb-3">
        <div className="text-xs text-slate-500">Current Phase</div>
        <div className="text-lg font-bold text-blue-400">
          {getPhaseName(simulation.state.phase)}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => simulation.state.isPlaying && !simulation.state.isPaused ? simulation.pause() : simulation.play()}
          className={`${styles.button} flex-1 ${styles.buttonPrimary}`}
        >
          {simulation.state.isPlaying && !simulation.state.isPaused ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={onStop}
          className={`${styles.button} ${styles.buttonDanger}`}
        >
          ⏹ Stop
        </button>
      </div>
      
      {/* Speed */}
      <div className="mb-3">
        <label className={styles.label}>Speed: {simulation.state.playbackSpeed}x</label>
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          value={simulation.state.playbackSpeed}
          onChange={(e) => simulation.setSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* Flight data */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">GS</div>
          <div className="font-mono">{simulation.state.groundSpeedKts.toFixed(0)} kt</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">ALT</div>
          <div className="font-mono">{simulation.state.altitudeFt.toFixed(0)} ft</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">HDG</div>
          <div className="font-mono">{simulation.state.headingTrue.toFixed(0)}°</div>
        </div>
        <div className="bg-slate-700 p-2 rounded">
          <div className="text-slate-500">VS</div>
          <div className="font-mono">{simulation.state.verticalSpeedFpm.toFixed(0)} fpm</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FLIGHT PLAN PANEL COMPONENT
// ============================================================================

interface FlightPlanPanelProps {
  route: FlightRoute | null;
  aircraft: AircraftProfile | null;
  dispatchResult: DispatchResult | null;
  departureIcao: string;
  arrivalIcao: string;
}

function FlightPlanPanel({ route, aircraft, dispatchResult, departureIcao, arrivalIcao }: FlightPlanPanelProps) {
  if (!route || !aircraft) {
    return (
      <div className={`${styles.card} text-center text-slate-500 text-sm`}>
        Select departure, arrival, and aircraft to see flight plan
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Route header */}
      <div className={styles.card}>
        <div className="flex items-center justify-center gap-4 text-xl font-mono">
          <span className="text-green-400">{departureIcao}</span>
          <span className="text-slate-500">→</span>
          <span className="text-blue-400">{arrivalIcao}</span>
        </div>
        <div className="text-center text-slate-500 text-sm mt-1">
          {aircraft.name}
        </div>
      </div>
      
      {/* Summary stats */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Flight Summary</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-mono font-bold text-white">
              {route.totalDistance.toFixed(0)}
            </div>
            <div className="text-xs text-slate-500">Distance (nm)</div>
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-white">
              {Math.floor(route.totalTime / 60)}:{String(Math.round(route.totalTime % 60)).padStart(2, '0')}
            </div>
            <div className="text-xs text-slate-500">Flight Time</div>
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-white">
              FL{Math.round(aircraft.cruiseAltitudeFt / 100)}
            </div>
            <div className="text-xs text-slate-500">Cruise FL</div>
          </div>
        </div>
      </div>
      
      {/* Route legs */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Route Legs</div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {route.waypoints.map((wp, i) => (
            <div key={i} className="flex items-center text-xs py-1 border-b border-slate-700 last:border-0">
              <span className="w-6 text-slate-500">{i + 1}</span>
              <span className="flex-1 font-mono text-white">{wp.name}</span>
              <span className="text-slate-400">{wp.type}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Fuel breakdown */}
      {dispatchResult && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Fuel Plan</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Taxi</span>
              <span className="font-mono">{dispatchResult.fuelPlan.taxiOutFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Trip</span>
              <span className="font-mono">{dispatchResult.fuelPlan.tripFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contingency (5%)</span>
              <span className="font-mono">{dispatchResult.fuelPlan.contingencyFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Alternate</span>
              <span className="font-mono">{dispatchResult.fuelPlan.alternateFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Final Reserve</span>
              <span className="font-mono">{dispatchResult.fuelPlan.finalReserveFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-600 font-semibold">
              <span className="text-white">Block Fuel</span>
              <span className="font-mono text-blue-400">{dispatchResult.fuelPlan.blockFuelKg.toLocaleString()} kg</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Weight summary */}
      {dispatchResult && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Weights</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">OEW</span>
              <span className="font-mono">{dispatchResult.weights.oewKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payload</span>
              <span className="font-mono">{dispatchResult.weights.payloadKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ZFW</span>
              <span className="font-mono">{dispatchResult.weights.zfwKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fuel</span>
              <span className="font-mono">{dispatchResult.weights.blockFuelKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-600">
              <span className="text-white font-semibold">TOW</span>
              <span className={`font-mono ${dispatchResult.checks.towWeight.passed ? 'text-green-400' : 'text-red-400'}`}>
                {dispatchResult.weights.towKg.toLocaleString()} kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white font-semibold">LW</span>
              <span className={`font-mono ${dispatchResult.checks.lwWeight.passed ? 'text-green-400' : 'text-red-400'}`}>
                {dispatchResult.weights.lwKg.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EFB COMPONENT
// ============================================================================

interface EFBMainScreenProps {
  onOpenSettings: () => void;
  airportCount: number;
  onAirportUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function EFBMainScreen({ onOpenSettings, airportCount }: Omit<EFBMainScreenProps, 'onAirportUpload'>) {
  // Mode
  const [mode, setMode] = useState<AppMode>('PLANNING');
  
  // Planning state
  const [departureIcao, setDepartureIcao] = useState('');
  const [arrivalIcao, setArrivalIcao] = useState('');
  const [departureAirport, setDepartureAirport] = useState<CSVAirport | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState<CSVAirport | null>(null);
  const [departureRunways, setDepartureRunways] = useState<Runway[]>([]);
  const [arrivalRunways, setArrivalRunways] = useState<Runway[]>([]);
  const [departureSelectedRunway, setDepartureSelectedRunway] = useState<SelectedRunway | null>(null);
  const [arrivalSelectedRunway, setArrivalSelectedRunway] = useState<SelectedRunway | null>(null);
  const [aircraftCode, setAircraftCode] = useState('');
  const [aircraft, setAircraft] = useState<AircraftProfile | null>(null);
  const [payloadKg, setPayloadKg] = useState(15000);
  const [route, setRoute] = useState<FlightRoute | null>(null);
  
  // Weather
  const [departureMetar, setDepartureMetar] = useState<DecodedMetar | null>(null);
  const [arrivalMetar, setArrivalMetar] = useState<DecodedMetar | null>(null);
  const [departureTaf, setDepartureTaf] = useState<DecodedTaf | null>(null);
  const [arrivalTaf, setArrivalTaf] = useState<DecodedTaf | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  
  // Dispatch
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  
  // Simulation
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const simulation = usePhaseSimulation();
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Load runways when airport changes
  useEffect(() => {
    if (departureIcao.length >= 3) {
      setDepartureRunways(getRunwaysForAirport(departureIcao));
      setDepartureSelectedRunway(null);
    } else {
      setDepartureRunways([]);
    }
  }, [departureIcao]);
  
  useEffect(() => {
    if (arrivalIcao.length >= 3) {
      setArrivalRunways(getRunwaysForAirport(arrivalIcao));
      setArrivalSelectedRunway(null);
    } else {
      setArrivalRunways([]);
    }
  }, [arrivalIcao]);
  
  // Fetch weather
  const fetchWeather = useCallback(async () => {
    const icaos: string[] = [];
    if (departureIcao.length === 4) icaos.push(departureIcao);
    if (arrivalIcao.length === 4) icaos.push(arrivalIcao);
    
    if (icaos.length === 0) return;
    
    setWeatherLoading(true);
    try {
      const metars = await fetchMetar(icaos);
      setDepartureMetar(metars.find(m => m.icao === departureIcao) || null);
      setArrivalMetar(metars.find(m => m.icao === arrivalIcao) || null);
      
      const tafs = await fetchTaf(icaos);
      setDepartureTaf(tafs.find(t => t.icao === departureIcao) || null);
      setArrivalTaf(tafs.find(t => t.icao === arrivalIcao) || null);
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setWeatherLoading(false);
    }
  }, [departureIcao, arrivalIcao]);
  
  useEffect(() => {
    if (departureIcao.length === 4 || arrivalIcao.length === 4) {
      fetchWeather();
    }
  }, [departureIcao, arrivalIcao, fetchWeather]);
  
  // Generate route
  useEffect(() => {
    if (
      mode === 'PLANNING' &&
      departureAirport &&
      arrivalAirport &&
      departureSelectedRunway &&
      arrivalSelectedRunway &&
      aircraft
    ) {
      try {
        // Get dispatcher service aircraft for route generation
        const dispatcherAircraft = {
          cruiseAltitudeFt: aircraft.cruiseAltitudeFt,
          cruiseSpeedKts: aircraft.cruiseSpeedKts,
        };
        
        const flightRoute = generateFlightRouteWithRunways(
          departureAirport,
          arrivalAirport,
          departureSelectedRunway,
          arrivalSelectedRunway,
          dispatcherAircraft.cruiseAltitudeFt,
          dispatcherAircraft.cruiseSpeedKts
        );
        setRoute(flightRoute);
      } catch (error) {
        console.error('Route generation error:', error);
        setRoute(null);
      }
    }
  }, [mode, departureAirport, arrivalAirport, departureSelectedRunway, arrivalSelectedRunway, aircraft]);
  
  // Run dispatch evaluation
  useEffect(() => {
    if (route && aircraft && departureSelectedRunway && arrivalSelectedRunway) {
      const result = evaluateDispatch({
        routeDistanceNm: route.totalDistance,
        departureIcao,
        arrivalIcao,
        departureElevationFt: departureAirport?.elevation || 0,
        arrivalElevationFt: arrivalAirport?.elevation || 0,
        departureRunwayLengthFt: departureSelectedRunway.runway.length,
        departureRunwaySurface: departureSelectedRunway.runway.surface,
        departureRunwayHeading: departureSelectedRunway.end.heading,
        arrivalRunwayLengthFt: arrivalSelectedRunway.runway.length,
        arrivalRunwaySurface: arrivalSelectedRunway.runway.surface,
        arrivalRunwayHeading: arrivalSelectedRunway.end.heading,
        departureMetar,
        arrivalMetar,
        payloadKg,
        aircraft,
      });
      setDispatchResult(result);
    } else {
      setDispatchResult(null);
    }
  }, [route, aircraft, departureSelectedRunway, arrivalSelectedRunway, departureMetar, arrivalMetar, payloadKg, departureIcao, arrivalIcao, departureAirport, arrivalAirport]);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleDepartureChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setDepartureIcao(icao);
    setDepartureAirport(airport);
  }, []);
  
  const handleArrivalChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setArrivalIcao(icao);
    setArrivalAirport(airport);
  }, []);
  
  const handleAircraftChange = useCallback((code: string) => {
    setAircraftCode(code);
    setAircraft(getAircraftProfile(code) || null);
    setRoute(null);
  }, []);
  
  const handleStartSimulation = useCallback(() => {
    if (!route || !dispatchResult?.feasible || !departureSelectedRunway || !arrivalSelectedRunway || !aircraft) {
      return;
    }
    
    try {
      // Create dispatcher service compatible aircraft for snapshot
      const dispatcherAircraft = {
        icaoCode: aircraft.icaoCode,
        name: aircraft.name,
        mtow: aircraft.mtow,
        mlw: aircraft.mlw,
        mzfw: aircraft.mzfw,
        oew: aircraft.oew,
        maxFuelCapacity: aircraft.maxFuelCapacity,
        maxRangeNm: aircraft.maxRangeNm,
        cruiseSpeedKts: aircraft.cruiseSpeedKts,
        cruiseAltitudeFt: aircraft.cruiseAltitudeFt,
        fuelBurnClimb: aircraft.climbFuelFlowKgHr,
        fuelBurnCruise: aircraft.cruiseFuelFlowKgHr,
        fuelBurnDescent: aircraft.descentFuelFlowKgHr,
        fuelBurnHolding: aircraft.holdingFuelFlowKgHr,
        fuelBurnTaxi: aircraft.taxiFuelFlowKgHr,
        takeoffDistanceM: aircraft.takeoffDistanceFt * 0.3048,
        landingDistanceM: aircraft.landingDistanceFt * 0.3048,
        maxCrosswindKts: aircraft.maxCrosswindKt,
        maxTailwindKts: aircraft.maxTailwindKt,
        maxHeadwindKts: 99,
        climbRateFpm: 2500,
        descentRateFpm: 1800,
        v1: 140,
        vr: 145,
        v2: 155,
        vref: 135,
        approachSpeedKts: 140,
        rangeNm: aircraft.maxRangeNm,
      };
      
      const planningState: PlanningStateForSnapshot = {
        departureIcao,
        arrivalIcao,
        departureRunway: departureSelectedRunway,
        arrivalRunway: arrivalSelectedRunway,
        aircraft: dispatcherAircraft as any,
        route,
      };
      
      const newSnapshot = createSimulationSnapshot(planningState);
      setSnapshot(newSnapshot);
      simulation.loadSnapshot(newSnapshot);
      setMode('SIMULATION');
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  }, [route, dispatchResult, departureIcao, arrivalIcao, departureSelectedRunway, arrivalSelectedRunway, aircraft, simulation]);
  
  const handleStopSimulation = useCallback(() => {
    simulation.stop();
    setSnapshot(null);
    setMode('PLANNING');
  }, [simulation]);
  
  // Route coordinates for map
  const routeCoordinates = useMemo((): [number, number][] => {
    if (mode === 'SIMULATION' && snapshot) {
      return snapshot.route.waypoints.map(wp => [wp.lat, wp.lon]);
    }
    if (route) {
      return route.waypoints.map(wp => [wp.position.lat, wp.position.lon]);
    }
    return [];
  }, [mode, snapshot, route]);
  
  const canStartSimulation = !!(dispatchResult?.feasible && route !== null);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>✈️ Flight Planner EFB</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {weatherLoading && <span className="text-xs text-slate-400">Loading weather...</span>}
          <span className={`${styles.badge} ${mode === 'SIMULATION' ? 'bg-green-600' : 'bg-slate-600'}`}>
            {mode}
          </span>
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-slate-700 rounded"
            title="Settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
              <path d="M12.475 8l1.86-1.798-1.62-2.804-2.435.697L9.627 1.5h-3.25L5.75 4.095 3.3 3.398 1.68 6.204l1.87 1.807-1.87 1.81 1.62 2.806 2.45-.7.637 2.572h3.25l.643-2.565 2.465.705 1.622-2.805L12.475 8zm-.225 3.453l-2.183-.628-.67.463-.55 2.212h-1.68l-.55-2.2-.647-.475-2.195.628L2.935 10 4.57 8.42v-.81L2.935 6.027l.84-1.455 2.197.63.648-.517.547-2.185h1.68l.55 2.195.645.518 2.208-.64.84 1.454-1.638 1.583.025.808L13.1 10l-.85 1.453z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        {/* LEFT PANEL - Route, Aircraft, Weather, Dispatch */}
        <aside className={styles.leftPanel}>
          <div className={styles.panelHeader}>Flight Planning</div>
          <div className={styles.panelContent}>
            {/* Route selection */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Route</div>
              
              <div className="space-y-3">
                {/* Departure */}
                <div className="border-l-2 border-green-500 pl-2">
                  <AirportSelector
                    label="Departure"
                    value={departureIcao}
                    onChange={handleDepartureChange}
                    airportCount={airportCount}
                    disabled={mode === 'SIMULATION'}
                  />
                  <div className="mt-2">
                    <RunwaySelector
                      label="Runway"
                      runways={departureRunways}
                      selectedRunway={departureSelectedRunway}
                      onSelect={setDepartureSelectedRunway}
                      disabled={mode === 'SIMULATION' || !departureAirport}
                      requiredLength={aircraft?.takeoffDistanceFt || 0}
                    />
                  </div>
                </div>
                
                {/* Arrival */}
                <div className="border-l-2 border-blue-500 pl-2">
                  <AirportSelector
                    label="Arrival"
                    value={arrivalIcao}
                    onChange={handleArrivalChange}
                    airportCount={airportCount}
                    disabled={mode === 'SIMULATION'}
                  />
                  <div className="mt-2">
                    <RunwaySelector
                      label="Runway"
                      runways={arrivalRunways}
                      selectedRunway={arrivalSelectedRunway}
                      onSelect={setArrivalSelectedRunway}
                      disabled={mode === 'SIMULATION' || !arrivalAirport}
                      requiredLength={aircraft?.landingDistanceFt || 0}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Aircraft selection */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Aircraft</div>
              <select
                value={aircraftCode}
                onChange={(e) => handleAircraftChange(e.target.value)}
                disabled={mode === 'SIMULATION'}
                className={styles.select}
              >
                <option value="">Select aircraft</option>
                {Object.values(AIRCRAFT_PROFILES).map(ac => (
                  <option key={ac.icaoCode} value={ac.icaoCode}>
                    {ac.icaoCode} - {ac.name}
                  </option>
                ))}
              </select>
              
              {aircraft && (
                <div className="mt-2 text-xs text-slate-400">
                  MTOW: {aircraft.mtow.toLocaleString()} kg | Range: {aircraft.maxRangeNm.toLocaleString()} nm
                </div>
              )}
              
              {/* Payload input */}
              <div className="mt-3">
                <label className={styles.label}>Payload (kg)</label>
                <input
                  type="number"
                  value={payloadKg}
                  onChange={(e) => setPayloadKg(parseInt(e.target.value) || 0)}
                  disabled={mode === 'SIMULATION'}
                  className={styles.input}
                  min={0}
                  max={50000}
                  step={500}
                />
              </div>
            </div>
            
            {/* METAR / TAF */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">Weather</span>
                <button 
                  onClick={fetchWeather}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  🔄 Refresh
                </button>
              </div>
              <MetarDisplay 
                icao={departureIcao} 
                metar={departureMetar} 
                taf={departureTaf}
                type="departure" 
              />
              <div className="mt-2">
                <MetarDisplay 
                  icao={arrivalIcao} 
                  metar={arrivalMetar} 
                  taf={arrivalTaf}
                  type="arrival" 
                />
              </div>
            </div>
            
            {/* Dispatch Release */}
            {mode === 'PLANNING' ? (
              <DispatchRelease
                result={dispatchResult}
                onStartSimulation={handleStartSimulation}
                canStart={canStartSimulation}
                mode={mode}
              />
            ) : (
              <SimulationControlsPanel
                simulation={simulation}
                onStop={handleStopSimulation}
              />
            )}
          </div>
        </aside>

        {/* CENTER - Map */}
        <section className={styles.centerPanel}>
          <PassiveFlightMap
            snapshot={snapshot}
            output={simulation.isReady ? simulation.output : null}
            routeCoordinates={routeCoordinates}
          />
        </section>

        {/* RIGHT PANEL - Flight Plan */}
        <aside className={styles.rightPanel}>
          <div className={styles.panelHeader}>Flight Plan</div>
          <div className={styles.panelContent}>
            <FlightPlanPanel
              route={route}
              aircraft={aircraft}
              dispatchResult={dispatchResult}
              departureIcao={departureIcao}
              arrivalIcao={arrivalIcao}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}

export default EFBMainScreen;
