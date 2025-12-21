/**
 * Runway-Based Flight Planner with 2D Map
 * 
 * THIS IS THE CORRECT IMPLEMENTATION that:
 * 1. Selects airports by ICAO code
 * 2. REQUIRES runway selection before simulation
 * 3. Uses runway threshold as the single source of truth
 * 4. Animates from runway threshold on a 2D map
 * 
 * DATA FLOW:
 * 1. User selects departure airport (ICAO)
 * 2. App loads runways from airport data
 * 3. User selects departure runway (e.g., RWY 09L)
 * 4. User selects arrival airport and runway
 * 5. Route is calculated FROM departure threshold TO arrival threshold
 * 6. Simulation starts at departure runway threshold
 * 7. Aircraft heading aligns with runway heading
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { SimpleFlightMap } from '@/components/Map/SimpleFlightMap';
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
  container: 'min-h-screen bg-gray-100',
  header: 'bg-blue-900 p-4 border-b border-blue-800',
  headerTitle: 'text-2xl font-bold text-white',
  headerSubtitle: 'text-blue-200 text-sm',
  main: 'flex flex-col lg:flex-row gap-4 p-4',
  sidebar: 'lg:w-[400px] space-y-4',
  content: 'flex-1',
  card: 'bg-white rounded-lg p-4 shadow-md',
  cardTitle: 'text-lg font-semibold mb-3 text-blue-800',
  input: 'w-full border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
  select: 'w-full border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
  button: 'px-4 py-2 rounded font-medium transition-colors',
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
  buttonSecondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
  buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
  label: 'block text-sm font-medium text-gray-700 mb-1',
  alert: 'p-3 rounded border',
  alertSuccess: 'bg-green-50 border-green-300 text-green-800',
  alertWarning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  alertError: 'bg-red-50 border-red-300 text-red-800',
};

// ============================================================================
// HELPER: GET RUNWAYS FROM ALL SOURCES
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
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
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

        <p className="text-xs text-gray-500">
          Or use built-in airports: KJFK, KLAX, EGLL, LFPG, etc.
        </p>
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((apt) => (
            <button
              key={apt.icao}
              onClick={() => handleSelect(apt)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm"
            >
              <span className="font-mono font-bold text-blue-600">{apt.icao}</span>
              <span className="text-gray-600 ml-2">{apt.name}</span>
              {hasRunwayData(apt.icao) || builtInAirports[apt.icao]?.runways?.length > 0 ? (
                <span className="text-green-600 ml-2 text-xs">✓ RWY</span>
              ) : (
                <span className="text-yellow-600 ml-2 text-xs">⚠ No RWY</span>
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
      <h3 className={styles.cardTitle}>🎮 Flight Simulation</h3>
      
      <div className="space-y-4">
        {/* Current phase */}
        <div className="text-center p-2 bg-blue-50 rounded">
          <span className="text-sm text-gray-600">Phase:</span>
          <div className="text-lg font-bold text-blue-700">
            {state.phase.replace(/_/g, ' ')}
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
            ⏹ Reset
          </button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{state.timeElapsed.toFixed(0)} min</span>
            <span>{(state.progress * 100).toFixed(0)}%</span>
            <span>{state.timeRemaining.toFixed(0)} min left</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={state.progress * 100}
            onChange={(e) => onSeek(parseInt(e.target.value) / 100)}
            disabled={!isReady}
            className="w-full"
          />
        </div>

        {/* Speed */}
        <div>
          <label className={styles.label}>Speed: {state.playbackSpeed}x</label>
          <div className="flex gap-1">
            {[0.5, 1, 2, 4, 8, 16].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`${styles.button} ${state.playbackSpeed === s ? styles.buttonPrimary : styles.buttonSecondary} flex-1 text-xs py-1`}
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
  route: FlightRoute | null;
}

function FlightData({ state, route }: FlightDataProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📊 Flight Data</h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Position</div>
          <div className="font-mono text-xs">
            {state.position.lat.toFixed(4)}°N<br/>
            {state.position.lon.toFixed(4)}°E
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Altitude</div>
          <div className="font-bold text-blue-700">{state.altitude.toLocaleString()} ft</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Heading</div>
          <div className="font-bold">{state.heading}°</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Ground Speed</div>
          <div className="font-bold">{state.groundSpeed} kt</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Vertical Speed</div>
          <div className={`font-bold ${state.verticalSpeed > 0 ? 'text-green-600' : state.verticalSpeed < 0 ? 'text-red-600' : ''}`}>
            {state.verticalSpeed > 0 ? '+' : ''}{state.verticalSpeed} fpm
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-500 text-xs">Distance</div>
          <div className="font-bold">{state.distanceFlown.toFixed(1)} / {(state.distanceFlown + state.distanceRemaining).toFixed(0)} nm</div>
        </div>
      </div>

      {route && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-600">
          <div><strong>DEP:</strong> RWY {route.departureRunway.designator} ({route.departureRunway.end.heading}°)</div>
          <div><strong>ARR:</strong> RWY {route.arrivalRunway.designator} ({route.arrivalRunway.end.heading}°)</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function RunwayFlightPlannerMap() {
  // Airport database
  const [airportCount, setAirportCount] = useState(0);
  
  // Selection state
  const [departureIcao, setDepartureIcao] = useState('');
  const [arrivalIcao, setArrivalIcao] = useState('');
  const [departureAirport, setDepartureAirport] = useState<CSVAirport | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState<CSVAirport | null>(null);
  const [aircraftCode, setAircraftCode] = useState('');
  const [aircraft, setAircraft] = useState<AircraftPerformance | null>(null);
  
  // Runway state
  const [departureRunways, setDepartureRunways] = useState<Runway[]>([]);
  const [arrivalRunways, setArrivalRunways] = useState<Runway[]>([]);
  const [departureSelectedRunway, setDepartureSelectedRunway] = useState<SelectedRunway | null>(null);
  const [arrivalSelectedRunway, setArrivalSelectedRunway] = useState<SelectedRunway | null>(null);
  
  // Route state
  const [route, setRoute] = useState<FlightRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Simulation
  const simulation = useRunwaySimulation({
    route,
    duration: 120,
    autoPlay: false,
  });

  // Load runways when departure changes
  useEffect(() => {
    if (departureIcao) {
      const runways = getRunwaysForAirport(departureIcao);
      setDepartureRunways(runways);
      setDepartureSelectedRunway(null);
    } else {
      setDepartureRunways([]);
      setDepartureSelectedRunway(null);
    }
    setRoute(null);
    setRouteError(null);
  }, [departureIcao]);

  // Load runways when arrival changes
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

  // Generate route when all selections made
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

  const canSimulate = simulation.isReady && route !== null;

  // Validation
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
        <h1 className={styles.headerTitle}>✈️ Flight Planner - Runway-Based</h1>
        <p className={styles.headerSubtitle}>
          Select runways • Aircraft spawns at threshold • Realistic takeoff sequence
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
              <div className="border border-green-200 bg-green-50 rounded p-3 space-y-3">
                <div className="text-sm font-medium text-green-700">🛫 DEPARTURE</div>
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
              <div className="border border-blue-200 bg-blue-50 rounded p-3 space-y-3">
                <div className="text-sm font-medium text-blue-700">🛬 ARRIVAL</div>
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
              
              {routeError && (
                <div className={`${styles.alert} ${styles.alertError}`}>
                  {routeError}
                </div>
              )}
              
              {route && (
                <div className={`${styles.alert} ${styles.alertSuccess}`}>
                  ✓ Route: {route.totalDistance.toFixed(0)} nm, {route.totalTime.toFixed(0)} min
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
          {simulation.isReady && <FlightData state={simulation.state} route={route} />}
        </aside>

        {/* Map */}
        <section className={styles.content}>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <SimpleFlightMap
              routeCoordinates={route ? route.waypoints.map(wp => [wp.position.lat, wp.position.lon] as [number, number]) : []}
              aircraftPosition={simulation.isReady ? { lat: simulation.state.position.lat, lon: simulation.state.position.lon } : null}
              aircraftHeading={simulation.state.heading}
              departurePosition={departureSelectedRunway ? { lat: departureSelectedRunway.end.threshold.lat, lon: departureSelectedRunway.end.threshold.lon } : null}
              arrivalPosition={arrivalSelectedRunway ? { lat: arrivalSelectedRunway.end.threshold.lat, lon: arrivalSelectedRunway.end.threshold.lon } : null}
              departureLabel={departureSelectedRunway ? `${departureIcao} RWY ${departureSelectedRunway.designator}` : departureIcao}
              arrivalLabel={arrivalSelectedRunway ? `${arrivalIcao} RWY ${arrivalSelectedRunway.designator}` : arrivalIcao}
              isPlaying={simulation.state.isPlaying}
            />
          </div>

          {/* Instructions overlay */}
          {!route && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">Getting Started</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Enter departure airport ICAO (e.g., KJFK, EGLL, LFPG)</li>
                <li><strong>Select the departure RUNWAY</strong> (critical!)</li>
                <li>Enter arrival airport ICAO</li>
                <li><strong>Select the arrival RUNWAY</strong></li>
                <li>Select aircraft type</li>
                <li>Press Play to start simulation</li>
              </ol>
              <p className="text-xs text-blue-600 mt-2">
                ✈️ Aircraft will spawn at runway threshold and follow correct heading
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
