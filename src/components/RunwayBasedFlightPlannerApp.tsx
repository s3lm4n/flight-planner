/**
 * Runway-Based Flight Planner Application
 * 
 * THIS IS THE CORRECT IMPLEMENTATION that:
 * 1. Selects airports by ICAO code
 * 2. REQUIRES runway selection before simulation
 * 3. Uses runway threshold as the single source of truth
 * 4. Animates from runway threshold, NOT airport center
 * 
 * DATA FLOW:
 * 1. User selects departure airport (ICAO)
 * 2. App loads runways from airport data
 * 3. User selects departure runway (e.g., RWY 09L)
 * 4. User selects arrival airport and runway
 * 5. Route is calculated FROM departure threshold TO arrival threshold
 * 6. Simulation starts at departure runway threshold
 * 7. Aircraft heading aligns with runway heading
 * 8. Takeoff animation follows runway centerline
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FlightScene } from '@/components/3D/FlightScene';
import { 
  parseAirportFile, 
  airportDB, 
  CSVAirport,
  ParseResult 
} from '@/services/airports/airportParser';
import { RunwaySelector } from '@/components/UI/RunwaySelector';
import { Runway, SelectedRunway } from '@/types/runway';
import { getAirportRunways, hasRunwayData } from '@/data/runwayDatabase';
import { airports as builtInAirports } from '@/data/airports';
import { 
  generateFlightRouteWithRunways, 
  FlightRoute 
} from '@/services/route/runwayBasedRouteCalculator';
import { useRunwaySimulation, SimulationState } from '@/simulation/RunwayBasedSimulation';
import {
  AIRCRAFT_DATABASE,
  AircraftPerformance,
  getAircraft,
} from '@/services/dispatcher/dispatcherService';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: 'min-h-screen bg-gray-900 text-white',
  header: 'bg-gray-800 p-4 border-b border-gray-700',
  headerTitle: 'text-2xl font-bold text-blue-400',
  headerSubtitle: 'text-gray-400 text-sm',
  main: 'flex flex-col lg:flex-row gap-4 p-4',
  sidebar: 'lg:w-[420px] space-y-4',
  content: 'flex-1 min-h-[600px]',
  card: 'bg-gray-800 rounded-lg p-4 border border-gray-700',
  cardTitle: 'text-lg font-semibold mb-3 text-blue-300',
  input: 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none',
  select: 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none',
  button: 'px-4 py-2 rounded font-medium transition-colors',
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
  buttonSecondary: 'bg-gray-600 hover:bg-gray-700 text-white',
  buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
  buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
  label: 'block text-sm font-medium text-gray-300 mb-1',
  alert: 'p-3 rounded border',
  alertSuccess: 'bg-green-900/50 border-green-600 text-green-200',
  alertWarning: 'bg-yellow-900/50 border-yellow-600 text-yellow-200',
  alertError: 'bg-red-900/50 border-red-600 text-red-200',
};

// ============================================================================
// HELPER: GET RUNWAYS FROM ALL SOURCES
// ============================================================================

function getRunwaysForAirport(icao: string): Runway[] {
  // First check runway database
  if (hasRunwayData(icao)) {
    return getAirportRunways(icao);
  }
  
  // Fall back to built-in airport data
  const builtIn = builtInAirports[icao];
  if (builtIn && builtIn.runways) {
    // Convert built-in runway format to Runway type
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

// ============================================================================
// AIRPORT UPLOADER COMPONENT
// ============================================================================

interface AirportUploaderProps {
  onUpload: (result: ParseResult) => void;
}

function AirportUploader({ onUpload }: AirportUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const parseResult = await parseAirportFile(file);
      setResult(parseResult);
      if (parseResult.success) {
        airportDB.load(parseResult);
        onUpload(parseResult);
      }
    } catch (error) {
      console.error('Failed to parse file:', error);
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📁 Airport Database</h3>
      
      <div className="space-y-3">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isLoading}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
        
        {isLoading && (
          <div className={`${styles.alert} ${styles.alertWarning}`}>
            Loading airports...
          </div>
        )}
        
        {result && (
          <div className={`${styles.alert} ${result.success ? styles.alertSuccess : styles.alertError}`}>
            {result.success 
              ? `✓ Loaded ${result.validRows} airports`
              : `✗ Failed: ${result.errors.join(', ')}`
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AIRPORT SELECTOR (ICAO only)
// ============================================================================

interface AirportSelectorProps {
  label: string;
  value: string;
  onChange: (icao: string, airport: CSVAirport | null) => void;
  airportCount: number;
  disabled?: boolean;
}

function AirportSelector({ label, value, onChange, airportCount, disabled }: AirportSelectorProps) {
  const [search, setSearch] = useState(value);
  const [suggestions, setSuggestions] = useState<CSVAirport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search.length >= 2 && airportCount > 0) {
      const results = airportDB.search(search, 10);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [search, airportCount]);

  // Also check built-in airports
  useEffect(() => {
    if (search.length >= 2 && airportCount === 0) {
      const matches = Object.values(builtInAirports)
        .filter(apt => 
          apt.icao.includes(search.toUpperCase()) ||
          apt.name.toUpperCase().includes(search.toUpperCase())
        )
        .slice(0, 10);
      
      setSuggestions(matches.map(apt => ({
        icao: apt.icao,
        name: apt.name,
        latitude: apt.position.lat,
        longitude: apt.position.lon,
        elevation: apt.elevation,
      })));
    }
  }, [search, airportCount]);

  const handleSelect = (airport: CSVAirport) => {
    setSearch(airport.icao);
    onChange(airport.icao, airport);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSearch(val);
    setShowSuggestions(true);
    
    // Check for direct match in CSV database
    const csvAirport = airportDB.get(val);
    if (csvAirport) {
      onChange(val, csvAirport);
      return;
    }
    
    // Check built-in airports
    const builtIn = builtInAirports[val];
    if (builtIn) {
      onChange(val, {
        icao: builtIn.icao,
        name: builtIn.name,
        latitude: builtIn.position.lat,
        longitude: builtIn.position.lon,
        elevation: builtIn.elevation,
      });
      return;
    }
    
    onChange(val, null);
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
        placeholder="ICAO code (e.g., KJFK)"
        maxLength={4}
        className={styles.input}
        disabled={disabled}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((apt) => (
            <button
              key={apt.icao}
              onClick={() => handleSelect(apt)}
              className="w-full px-3 py-2 text-left hover:bg-gray-600 text-sm"
            >
              <span className="font-mono font-bold text-blue-400">{apt.icao}</span>
              <span className="text-gray-300 ml-2">{apt.name}</span>
              {hasRunwayData(apt.icao) || builtInAirports[apt.icao]?.runways?.length > 0 ? (
                <span className="text-green-400 ml-2 text-xs">✓ Runway data</span>
              ) : (
                <span className="text-yellow-400 ml-2 text-xs">⚠ No runway data</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AIRCRAFT SELECTOR
// ============================================================================

interface AircraftSelectorProps {
  value: string;
  onChange: (code: string, aircraft: AircraftPerformance | null) => void;
  disabled?: boolean;
}

function AircraftSelector({ value, onChange, disabled }: AircraftSelectorProps) {
  return (
    <div>
      <label className={styles.label}>Aircraft Type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value, getAircraft(e.target.value) || null)}
        className={styles.select}
        disabled={disabled}
      >
        <option value="">Select aircraft...</option>
        {AIRCRAFT_DATABASE.map((ac) => (
          <option key={ac.icaoCode} value={ac.icaoCode}>
            {ac.icaoCode} - {ac.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// SIMULATION CONTROLS
// ============================================================================

interface SimulationControlsProps {
  isReady: boolean;
  state: SimulationState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
}

function SimulationControls({
  isReady,
  state,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSpeedChange,
}: SimulationControlsProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>🎮 Simulation</h3>
      
      <div className="space-y-4">
        {/* Current phase display */}
        <div className="text-center">
          <span className="text-sm text-gray-400">Current Phase:</span>
          <div className="text-lg font-bold text-blue-400">
            {state.phase.replace('_', ' ')}
          </div>
        </div>

        {/* Play controls */}
        <div className="flex gap-2">
          {!state.isPlaying ? (
            <button
              onClick={onPlay}
              disabled={!isReady}
              className={`${styles.button} ${styles.buttonSuccess} flex-1`}
            >
              ▶ Play
            </button>
          ) : (
            <button
              onClick={onPause}
              className={`${styles.button} ${styles.buttonSecondary} flex-1`}
            >
              ⏸ Pause
            </button>
          )}
          <button
            onClick={onStop}
            disabled={!isReady}
            className={`${styles.button} ${styles.buttonDanger}`}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <input
            type="range"
            min="0"
            max="100"
            value={state.progress * 100}
            onChange={(e) => onSeek(parseInt(e.target.value) / 100)}
            disabled={!isReady}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{(state.progress * 100).toFixed(0)}%</span>
            <span>{state.timeElapsed.toFixed(0)}m / {(state.timeElapsed + state.timeRemaining).toFixed(0)}m</span>
          </div>
        </div>

        {/* Speed control */}
        <div>
          <label className={styles.label}>Speed: {state.playbackSpeed}x</label>
          <div className="flex gap-2">
            {[0.5, 1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`${styles.button} ${state.playbackSpeed === s ? styles.buttonPrimary : styles.buttonSecondary} flex-1 text-xs`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FLIGHT DATA DISPLAY
// ============================================================================

interface FlightDataProps {
  state: SimulationState;
}

function FlightData({ state }: FlightDataProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📊 Flight Data</h3>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-400">Position:</span>
          <span className="ml-2 font-mono text-xs">
            {state.position.lat.toFixed(4)}°, {state.position.lon.toFixed(4)}°
          </span>
        </div>
        <div>
          <span className="text-gray-400">Altitude:</span>
          <span className="ml-2">{state.altitude.toLocaleString()} ft</span>
        </div>
        <div>
          <span className="text-gray-400">Heading:</span>
          <span className="ml-2">{state.heading}°</span>
        </div>
        <div>
          <span className="text-gray-400">GS:</span>
          <span className="ml-2">{state.groundSpeed} kt</span>
        </div>
        <div>
          <span className="text-gray-400">IAS:</span>
          <span className="ml-2">{state.indicatedAirspeed} kt</span>
        </div>
        <div>
          <span className="text-gray-400">VS:</span>
          <span className="ml-2">{state.verticalSpeed} fpm</span>
        </div>
        <div>
          <span className="text-gray-400">Flown:</span>
          <span className="ml-2">{state.distanceFlown} nm</span>
        </div>
        <div>
          <span className="text-gray-400">Remaining:</span>
          <span className="ml-2">{state.distanceRemaining.toFixed(0)} nm</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function RunwayBasedFlightPlannerApp() {
  // Airport database
  const [airportCount, setAirportCount] = useState(0);
  
  // Selection state
  const [departureIcao, setDepartureIcao] = useState('');
  const [arrivalIcao, setArrivalIcao] = useState('');
  const [departureAirport, setDepartureAirport] = useState<CSVAirport | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState<CSVAirport | null>(null);
  const [aircraftCode, setAircraftCode] = useState('');
  const [aircraft, setAircraft] = useState<AircraftPerformance | null>(null);
  
  // Runway state - CRITICAL
  const [departureRunways, setDepartureRunways] = useState<Runway[]>([]);
  const [arrivalRunways, setArrivalRunways] = useState<Runway[]>([]);
  const [departureSelectedRunway, setDepartureSelectedRunway] = useState<SelectedRunway | null>(null);
  const [arrivalSelectedRunway, setArrivalSelectedRunway] = useState<SelectedRunway | null>(null);
  
  // Route state
  const [route, setRoute] = useState<FlightRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  // Camera
  const [cameraMode, setCameraMode] = useState<'orbit' | 'follow'>('orbit');

  // Simulation - uses runway-based simulation
  const simulation = useRunwaySimulation({
    route,
    duration: 120,
    autoPlay: false,
  });

  // Load runways when departure airport changes
  useEffect(() => {
    if (departureIcao) {
      const runways = getRunwaysForAirport(departureIcao);
      setDepartureRunways(runways);
      setDepartureSelectedRunway(null); // Reset selection
    } else {
      setDepartureRunways([]);
      setDepartureSelectedRunway(null);
    }
    setRoute(null);
    setRouteError(null);
  }, [departureIcao]);

  // Load runways when arrival airport changes
  useEffect(() => {
    if (arrivalIcao) {
      const runways = getRunwaysForAirport(arrivalIcao);
      setArrivalRunways(runways);
      setArrivalSelectedRunway(null);
    } else {
      setArrivalRunways([]);
      setArrivalSelectedRunway(null);
    }
    setRoute(null);
    setRouteError(null);
  }, [arrivalIcao]);

  // Generate route when all selections are made
  useEffect(() => {
    if (
      departureAirport &&
      arrivalAirport &&
      departureSelectedRunway &&
      arrivalSelectedRunway &&
      aircraft
    ) {
      try {
        const flightRoute = generateFlightRouteWithRunways(
          departureAirport,
          arrivalAirport,
          departureSelectedRunway,
          arrivalSelectedRunway,
          aircraft.cruiseAltitudeFt,
          aircraft.cruiseSpeedKts
        );
        setRoute(flightRoute);
        setRouteError(null);
      } catch (error) {
        console.error('Route generation failed:', error);
        setRouteError(error instanceof Error ? error.message : 'Failed to generate route');
        setRoute(null);
      }
    }
  }, [departureAirport, arrivalAirport, departureSelectedRunway, arrivalSelectedRunway, aircraft]);

  // Handlers
  const handleDepartureChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setDepartureIcao(icao);
    setDepartureAirport(airport);
  }, []);

  const handleArrivalChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setArrivalIcao(icao);
    setArrivalAirport(airport);
  }, []);

  const handleAircraftChange = useCallback((code: string, ac: AircraftPerformance | null) => {
    setAircraftCode(code);
    setAircraft(ac);
    setRoute(null);
  }, []);

  const handleAirportUpload = useCallback((result: ParseResult) => {
    setAirportCount(result.validRows);
  }, []);

  // Compute 3D scene data
  const sceneData = useMemo(() => {
    if (!route || !simulation.isReady) {
      return {
        routePoints: [] as [number, number, number][],
        departurePosition: [0, 0] as [number, number],
        arrivalPosition: [10, 0] as [number, number],
      };
    }

    // Calculate center from runway thresholds
    const depThreshold = route.departureRunway.end.threshold;
    const arrThreshold = route.arrivalRunway.end.threshold;
    const centerLat = (depThreshold.lat + arrThreshold.lat) / 2;
    const centerLon = (depThreshold.lon + arrThreshold.lon) / 2;
    
    // Convert waypoint positions to scene coordinates
    const routePoints = route.waypoints.map((wp): [number, number, number] => {
      const x = (wp.position.lon - centerLon) * 60 * Math.cos(centerLat * Math.PI / 180);
      const z = (centerLat - wp.position.lat) * 60;
      const y = wp.altitude * 0.0001; // Scale altitude
      return [x, y, z];
    });

    return {
      routePoints,
      departurePosition: [
        (depThreshold.lon - centerLon) * 60 * Math.cos(centerLat * Math.PI / 180),
        (centerLat - depThreshold.lat) * 60,
      ] as [number, number],
      arrivalPosition: [
        (arrThreshold.lon - centerLon) * 60 * Math.cos(centerLat * Math.PI / 180),
        (centerLat - arrThreshold.lat) * 60,
      ] as [number, number],
    };
  }, [route, simulation.isReady]);

  // Compute aircraft state for 3D
  const aircraft3DState = useMemo(() => {
    if (!simulation.isReady || !route) {
      return {
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        speed: 0,
        altitude: 0,
        heading: 0,
        phase: 'PARKED' as const,
      };
    }

    const state = simulation.state;
    const depThreshold = route.departureRunway.end.threshold;
    const arrThreshold = route.arrivalRunway.end.threshold;
    const centerLat = (depThreshold.lat + arrThreshold.lat) / 2;
    const centerLon = (depThreshold.lon + arrThreshold.lon) / 2;

    // Convert position to scene coordinates
    const x = (state.position.lon - centerLon) * 60 * Math.cos(centerLat * Math.PI / 180);
    const z = (centerLat - state.position.lat) * 60;
    const y = state.altitude * 0.0001;

    // Determine phase
    let phase: 'PARKED' | 'TAXI' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING' | 'LANDED' = 'PARKED';
    if (['CLIMB', 'INITIAL_CLIMB'].includes(state.phase)) phase = 'CLIMB';
    else if (state.phase === 'CRUISE') phase = 'CRUISE';
    else if (state.phase === 'DESCENT') phase = 'DESCENT';
    else if (state.phase === 'APPROACH' || state.phase === 'FINAL') phase = 'APPROACH';
    else if (state.phase === 'LANDING') phase = 'LANDING';
    else if (['TAXI_OUT', 'TAXI_IN', 'LINEUP', 'PUSHBACK'].includes(state.phase)) phase = 'TAXI';
    else if (['TAKEOFF_ROLL', 'ROTATION'].includes(state.phase)) phase = 'TAKEOFF';

    // Calculate rotation
    const yaw = -(state.heading - 90) * (Math.PI / 180);
    let pitch = 0;
    if (state.verticalSpeed > 500) pitch = -0.15;
    else if (state.verticalSpeed < -500) pitch = 0.08;

    return {
      position: [x, y, z] as [number, number, number],
      rotation: [pitch, yaw, 0] as [number, number, number],
      speed: state.groundSpeed,
      altitude: state.altitude,
      heading: state.heading,
      phase,
    };
  }, [simulation.isReady, simulation.state, route]);

  // Can we simulate?
  const canSimulate = simulation.isReady && route !== null;

  // Validation messages
  const validationStatus = useMemo(() => {
    const issues: string[] = [];
    
    if (!departureAirport) {
      issues.push('Select departure airport');
    } else if (departureRunways.length === 0) {
      issues.push(`No runway data for ${departureIcao}`);
    } else if (!departureSelectedRunway) {
      issues.push('Select departure runway');
    }
    
    if (!arrivalAirport) {
      issues.push('Select arrival airport');
    } else if (arrivalRunways.length === 0) {
      issues.push(`No runway data for ${arrivalIcao}`);
    } else if (!arrivalSelectedRunway) {
      issues.push('Select arrival runway');
    }
    
    if (!aircraft) {
      issues.push('Select aircraft type');
    }
    
    return issues;
  }, [departureAirport, arrivalAirport, departureRunways, arrivalRunways, departureSelectedRunway, arrivalSelectedRunway, aircraft, departureIcao, arrivalIcao]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>✈️ Flight Planner - Runway-Based Simulation</h1>
        <p className={styles.headerSubtitle}>
          Aircraft spawns at runway threshold • Takeoff follows runway heading
        </p>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Airport Upload */}
          <AirportUploader onUpload={handleAirportUpload} />

          {/* Flight Planning */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🗺️ Flight Planning</h3>
            
            <div className="space-y-4">
              {/* Departure */}
              <div className="border border-gray-700 rounded p-3 space-y-3">
                <div className="text-sm font-medium text-green-400">🛫 DEPARTURE</div>
                <AirportSelector
                  label="Airport (ICAO)"
                  value={departureIcao}
                  onChange={handleDepartureChange}
                  airportCount={airportCount}
                />
                <RunwaySelector
                  label="Departure Runway"
                  runways={departureRunways}
                  selectedRunway={departureSelectedRunway}
                  onSelect={setDepartureSelectedRunway}
                  disabled={!departureAirport}
                  requiredLength={aircraft?.takeoffDistanceM ? aircraft.takeoffDistanceM * 3.28084 : 0}
                />
              </div>
              
              {/* Arrival - Blue styling */}
              <div className="border border-gray-700 rounded p-3 space-y-3">
                <div className="text-sm font-medium text-blue-400">🛬 ARRIVAL</div>
                <AirportSelector
                  label="Airport (ICAO)"
                  value={arrivalIcao}
                  onChange={handleArrivalChange}
                  airportCount={airportCount}
                />
                <RunwaySelector
                  label="Arrival Runway"
                  runways={arrivalRunways}
                  selectedRunway={arrivalSelectedRunway}
                  onSelect={setArrivalSelectedRunway}
                  disabled={!arrivalAirport}
                  requiredLength={aircraft?.landingDistanceM ? aircraft.landingDistanceM * 3.28084 : 0}
                />
              </div>
              
              {/* Aircraft */}
              <AircraftSelector
                value={aircraftCode}
                onChange={handleAircraftChange}
              />
              
              {/* Validation */}
              {validationStatus.length > 0 && (
                <div className={`${styles.alert} ${styles.alertWarning}`}>
                  <div className="font-medium mb-1">Required:</div>
                  <ul className="text-xs list-disc list-inside">
                    {validationStatus.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Route error */}
              {routeError && (
                <div className={`${styles.alert} ${styles.alertError}`}>
                  {routeError}
                </div>
              )}
              
              {/* Ready status */}
              {route && (
                <div className={`${styles.alert} ${styles.alertSuccess}`}>
                  ✓ Route ready: {route.totalDistance.toFixed(0)} nm, {route.totalTime.toFixed(0)} min
                </div>
              )}
            </div>
          </div>

          {/* Simulation Controls */}
          <SimulationControls
            isReady={canSimulate}
            state={simulation.state}
            onPlay={simulation.play}
            onPause={simulation.pause}
            onStop={simulation.stop}
            onSeek={simulation.seek}
            onSpeedChange={simulation.setSpeed}
          />

          {/* Flight Data */}
          {simulation.isReady && <FlightData state={simulation.state} />}
        </aside>

        {/* 3D Scene */}
        <section className={styles.content}>
          <div className="bg-gray-800 rounded-lg overflow-hidden h-full relative">
            {/* Camera toggle */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button
                onClick={() => setCameraMode('orbit')}
                className={`${styles.button} ${cameraMode === 'orbit' ? styles.buttonPrimary : styles.buttonSecondary} text-xs`}
              >
                🌐 Orbit
              </button>
              <button
                onClick={() => setCameraMode('follow')}
                className={`${styles.button} ${cameraMode === 'follow' ? styles.buttonPrimary : styles.buttonSecondary} text-xs`}
              >
                🎥 Follow
              </button>
            </div>

            {/* Runway info overlay */}
            {departureSelectedRunway && (
              <div className="absolute top-4 left-4 z-10 bg-black/70 px-3 py-2 rounded text-xs">
                <div className="text-green-400">
                  DEP: RWY {departureSelectedRunway.designator} ({departureSelectedRunway.end.heading}°)
                </div>
                {arrivalSelectedRunway && (
                  <div className="text-red-400">
                    ARR: RWY {arrivalSelectedRunway.designator} ({arrivalSelectedRunway.end.heading}°)
                  </div>
                )}
              </div>
            )}

            {/* Scene */}
            <FlightScene
              aircraftState={aircraft3DState}
              routePoints={sceneData.routePoints}
              departurePosition={sceneData.departurePosition}
              arrivalPosition={sceneData.arrivalPosition}
              cameraMode={cameraMode}
              isNoGo={false}
            />

            {/* Instructions */}
            {!route && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-gray-800/90 px-8 py-6 rounded-lg text-center max-w-md">
                  <h2 className="text-xl text-gray-200 mb-4">Runway-Based Flight Planning</h2>
                  <ol className="text-left text-sm text-gray-400 space-y-2">
                    <li>1. Select departure airport (ICAO code)</li>
                    <li>2. <strong className="text-blue-400">Select departure RUNWAY</strong></li>
                    <li>3. Select arrival airport</li>
                    <li>4. <strong className="text-blue-400">Select arrival RUNWAY</strong></li>
                    <li>5. Select aircraft type</li>
                    <li>6. Press Play to start simulation</li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-4">
                    Aircraft will spawn at runway threshold and follow runway heading during takeoff
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
