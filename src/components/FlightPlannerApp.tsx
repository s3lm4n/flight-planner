/**
 * Flight Planner Main Application Component
 * 
 * This is the main entry point that integrates:
 * - CSV Airport upload
 * - Airport selection (by ICAO)
 * - Aircraft selection
 * - Dispatcher evaluation
 * - 3D flight simulation
 * - GO/NO-GO display
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FlightScene, routeToSceneCoords, createAircraftState } from '@/components/3D/FlightScene';
import { 
  parseAirportFile, 
  airportDB, 
  CSVAirport,
  ParseResult 
} from '@/services/airports/airportParser';
import {
  evaluateFlightDispatch,
  DispatchResult,
  AIRCRAFT_DATABASE,
  AircraftPerformance,
  getAircraft,
} from '@/services/dispatcher/dispatcherService';
import { generateFlightRoute, FlightRoute } from '@/services/route/routeCalculator';
import { useFlightSimulation } from '@/simulation/GSAPSimulation';

// ============================================================================
// STYLES (Tailwind classes)
// ============================================================================

const styles = {
  container: 'min-h-screen bg-gray-900 text-white',
  header: 'bg-gray-800 p-4 border-b border-gray-700',
  headerTitle: 'text-2xl font-bold text-blue-400',
  headerSubtitle: 'text-gray-400 text-sm',
  main: 'flex flex-col lg:flex-row gap-4 p-4',
  sidebar: 'lg:w-96 space-y-4',
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
  badge: 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
  badgeGo: 'bg-green-600 text-white',
  badgeNoGo: 'bg-red-600 text-white',
  badgeConditional: 'bg-yellow-600 text-white',
  alert: 'p-3 rounded border',
  alertWarning: 'bg-yellow-900/50 border-yellow-600 text-yellow-200',
  alertError: 'bg-red-900/50 border-red-600 text-red-200',
  alertInfo: 'bg-blue-900/50 border-blue-600 text-blue-200',
  alertSuccess: 'bg-green-900/50 border-green-600 text-green-200',
};

// ============================================================================
// SUB-COMPONENTS
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
          <div className={`${styles.alert} ${styles.alertInfo}`}>
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
          Required columns: icao (or ident), latitude, longitude<br/>
          Optional: elevation, name, iata, city, country
        </p>
      </div>
    </div>
  );
}

interface AirportSelectorProps {
  label: string;
  value: string;
  onChange: (icao: string, airport: CSVAirport | null) => void;
  airportCount: number;
}

function AirportSelector({ label, value, onChange, airportCount }: AirportSelectorProps) {
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

  const handleSelect = (airport: CSVAirport) => {
    setSearch(airport.icao);
    onChange(airport.icao, airport);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSearch(val);
    setShowSuggestions(true);
    
    // Direct match
    const airport = airportDB.get(val);
    onChange(val, airport || null);
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
        disabled={airportCount === 0}
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
            </button>
          ))}
        </div>
      )}
      
      {airportCount === 0 && (
        <p className="text-xs text-yellow-500 mt-1">Upload CSV first</p>
      )}
    </div>
  );
}

interface AircraftSelectorProps {
  value: string;
  onChange: (code: string, aircraft: AircraftPerformance | null) => void;
}

function AircraftSelector({ value, onChange }: AircraftSelectorProps) {
  return (
    <div>
      <label className={styles.label}>Aircraft Type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value, getAircraft(e.target.value) || null)}
        className={styles.select}
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

interface DispatchDisplayProps {
  result: DispatchResult | null;
  isLoading: boolean;
}

function DispatchDisplay({ result, isLoading }: DispatchDisplayProps) {
  if (isLoading) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>⏳ Evaluating Flight...</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>📋 Dispatch Decision</h3>
        <p className="text-gray-400">Select airports and aircraft to evaluate</p>
      </div>
    );
  }

  const badgeClass = result.decision === 'GO' 
    ? styles.badgeGo 
    : result.decision === 'NO-GO' 
    ? styles.badgeNoGo 
    : styles.badgeConditional;

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📋 Dispatch Decision</h3>
      
      {/* Main Decision */}
      <div className="flex items-center gap-4 mb-4">
        <span className={`${styles.badge} ${badgeClass} text-xl px-6 py-2`}>
          {result.decision === 'GO' ? '✅ GO' : 
           result.decision === 'NO-GO' ? '❌ NO-GO' : 
           '⚠️ CONDITIONAL'}
        </span>
      </div>

      {/* Route Info */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Route:</span>
          <span className="ml-2 font-mono">{result.departure.airport.icao} → {result.arrival.airport.icao}</span>
        </div>
        <div>
          <span className="text-gray-400">Distance:</span>
          <span className="ml-2">{result.distanceNm} nm</span>
        </div>
        <div>
          <span className="text-gray-400">Flight Time:</span>
          <span className="ml-2">{Math.floor(result.flightTimeMin / 60)}h {result.flightTimeMin % 60}m</span>
        </div>
        <div>
          <span className="text-gray-400">Aircraft:</span>
          <span className="ml-2">{result.aircraft.icaoCode}</span>
        </div>
      </div>

      {/* Critical Issues */}
      {result.criticalIssues.length > 0 && (
        <div className={`${styles.alert} ${styles.alertError} mb-3`}>
          <h4 className="font-bold mb-1">🚫 Critical Issues:</h4>
          <ul className="list-disc list-inside text-sm">
            {result.criticalIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className={`${styles.alert} ${styles.alertWarning} mb-3`}>
          <h4 className="font-bold mb-1">⚠️ Warnings:</h4>
          <ul className="list-disc list-inside text-sm">
            {result.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Fuel Plan */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-medium mb-2 text-blue-300">⛽ Fuel Plan</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>Taxi: {result.fuelPlan.taxiFuel} kg</div>
          <div>Trip: {result.fuelPlan.tripFuel} kg</div>
          <div>Contingency: {result.fuelPlan.contingencyFuel} kg</div>
          <div>Alternate: {result.fuelPlan.alternateFuel} kg</div>
          <div>Holding: {result.fuelPlan.holdingFuel} kg</div>
          <div>Reserve: {result.fuelPlan.finalReserveFuel} kg</div>
          <div className="col-span-2 font-bold border-t border-gray-700 pt-1">
            Block Fuel: {result.fuelPlan.blockFuel} kg
          </div>
        </div>
      </div>

      {/* Weights */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-medium mb-2 text-blue-300">⚖️ Weights</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>Payload: {result.fuelPlan.payloadKg} kg</div>
          <div>ZFW: {result.fuelPlan.zfwKg} kg</div>
          <div>TOW: {result.fuelPlan.towKg} kg</div>
          <div>RTOW: {result.rtow.actualRTOW} kg</div>
          <div>LDW: {result.fuelPlan.ldwKg} kg</div>
          <div>MLW: {result.aircraft.mlw} kg</div>
        </div>
      </div>

      {/* Weather Summary */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="font-medium mb-2 text-blue-300">🌤️ Weather</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-mono">{result.departure.airport.icao}:</span>
            <span className={`ml-2 ${
              result.departure.weather.category === 'VFR' ? 'text-green-400' :
              result.departure.weather.category === 'MVFR' ? 'text-blue-400' :
              result.departure.weather.category === 'IFR' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.departure.weather.category}
            </span>
            {!result.departure.weather.isLive && <span className="text-orange-400 ml-1">(sim)</span>}
          </div>
          <div>
            <span className="font-mono">{result.arrival.airport.icao}:</span>
            <span className={`ml-2 ${
              result.arrival.weather.category === 'VFR' ? 'text-green-400' :
              result.arrival.weather.category === 'MVFR' ? 'text-blue-400' :
              result.arrival.weather.category === 'IFR' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.arrival.weather.category}
            </span>
            {!result.arrival.weather.isLive && <span className="text-orange-400 ml-1">(sim)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SimulationControlsProps {
  isReady: boolean;
  isPlaying: boolean;
  progress: number;
  phase: string;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
}

function SimulationControls({
  isReady,
  isPlaying,
  progress,
  phase,
  speed,
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
        {/* Play controls */}
        <div className="flex gap-2">
          {!isPlaying ? (
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
            value={progress * 100}
            onChange={(e) => onSeek(parseInt(e.target.value) / 100)}
            disabled={!isReady}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{(progress * 100).toFixed(0)}%</span>
            <span>{phase.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Speed control */}
        <div>
          <label className={styles.label}>Speed: {speed}x</label>
          <div className="flex gap-2">
            {[0.5, 1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`${styles.button} ${speed === s ? styles.buttonPrimary : styles.buttonSecondary} flex-1 text-xs`}
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

interface FlightInfoProps {
  state: {
    altitude: number;
    groundSpeed: number;
    heading: number;
    distanceFlown: number;
    distanceRemaining: number;
    timeElapsed: number;
    timeRemaining: number;
    verticalSpeed: number;
  };
}

function FlightInfo({ state }: FlightInfoProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📊 Flight Data</h3>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-400">Altitude:</span>
          <span className="ml-2">{state.altitude.toLocaleString()} ft</span>
        </div>
        <div>
          <span className="text-gray-400">GS:</span>
          <span className="ml-2">{state.groundSpeed} kt</span>
        </div>
        <div>
          <span className="text-gray-400">Heading:</span>
          <span className="ml-2">{state.heading}°</span>
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
        <div>
          <span className="text-gray-400">Time:</span>
          <span className="ml-2">{state.timeElapsed.toFixed(0)} min</span>
        </div>
        <div>
          <span className="text-gray-400">ETE:</span>
          <span className="ml-2">{state.timeRemaining.toFixed(0)} min</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function FlightPlannerApp() {
  // Airport database state
  const [airportCount, setAirportCount] = useState(0);
  
  // Selection state
  const [departureIcao, setDepartureIcao] = useState('');
  const [arrivalIcao, setArrivalIcao] = useState('');
  const [departureAirport, setDepartureAirport] = useState<CSVAirport | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState<CSVAirport | null>(null);
  const [selectedAircraftCode, setSelectedAircraftCode] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftPerformance | null>(null);
  
  // Dispatch state
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Route state
  const [route, setRoute] = useState<FlightRoute | null>(null);
  
  // Camera mode
  const [cameraMode, setCameraMode] = useState<'orbit' | 'follow'>('orbit');

  // Simulation hook
  const simulation = useFlightSimulation({
    route,
    duration: 120, // 2 minutes for full flight
    autoPlay: false,
  });

  // Handle airport upload
  const handleAirportUpload = useCallback((result: ParseResult) => {
    setAirportCount(result.validRows);
  }, []);

  // Handle departure change
  const handleDepartureChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setDepartureIcao(icao);
    setDepartureAirport(airport);
    setDispatchResult(null);
    setRoute(null);
  }, []);

  // Handle arrival change
  const handleArrivalChange = useCallback((icao: string, airport: CSVAirport | null) => {
    setArrivalIcao(icao);
    setArrivalAirport(airport);
    setDispatchResult(null);
    setRoute(null);
  }, []);

  // Handle aircraft change
  const handleAircraftChange = useCallback((code: string, aircraft: AircraftPerformance | null) => {
    setSelectedAircraftCode(code);
    setSelectedAircraft(aircraft);
    setDispatchResult(null);
    setRoute(null);
  }, []);

  // Evaluate flight
  const evaluateFlight = useCallback(async () => {
    if (!departureAirport || !arrivalAirport || !selectedAircraft) return;
    
    setIsEvaluating(true);
    try {
      const result = await evaluateFlightDispatch(
        departureAirport,
        arrivalAirport,
        selectedAircraft,
        15000 // Default payload
      );
      setDispatchResult(result);

      // Generate route if GO or CONDITIONAL
      if (result.isGoDecision || result.decision === 'CONDITIONAL') {
        const flightRoute = generateFlightRoute(
          departureAirport,
          arrivalAirport,
          selectedAircraft.cruiseAltitudeFt,
          selectedAircraft.cruiseSpeedKts
        );
        setRoute(flightRoute);
      } else {
        setRoute(null);
      }
    } catch (error) {
      console.error('Dispatch evaluation failed:', error);
    }
    setIsEvaluating(false);
  }, [departureAirport, arrivalAirport, selectedAircraft]);

  // Auto-evaluate when all selections are made
  useEffect(() => {
    if (departureAirport && arrivalAirport && selectedAircraft) {
      evaluateFlight();
    }
  }, [departureAirport, arrivalAirport, selectedAircraft, evaluateFlight]);

  // Compute scene data
  const sceneData = useMemo(() => {
    if (!route || !simulation.isReady) {
      return {
        routePoints: [] as [number, number, number][],
        departurePosition: [0, 0] as [number, number],
        arrivalPosition: [10, 0] as [number, number],
      };
    }

    const center = simulation.sceneCenter;
    
    return {
      routePoints: routeToSceneCoords(route.waypoints, center.lat, center.lon),
      departurePosition: [
        (route.departure.longitude - center.lon) * 60 * Math.cos(center.lat * Math.PI / 180),
        (center.lat - route.departure.latitude) * 60,
      ] as [number, number],
      arrivalPosition: [
        (route.arrival.longitude - center.lon) * 60 * Math.cos(center.lat * Math.PI / 180),
        (center.lat - route.arrival.latitude) * 60,
      ] as [number, number],
    };
  }, [route, simulation.isReady, simulation.sceneCenter]);

  // Compute aircraft state for 3D scene
  const aircraft3DState = useMemo(() => {
    if (!simulation.isReady) {
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
    const center = simulation.sceneCenter;

    // Determine phase
    let phase: 'PARKED' | 'TAXI' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING' | 'LANDED' = 'PARKED';
    if (['CLIMB', 'INITIAL_CLIMB'].includes(state.phase)) phase = 'CLIMB';
    else if (state.phase === 'CRUISE') phase = 'CRUISE';
    else if (state.phase === 'DESCENT') phase = 'DESCENT';
    else if (state.phase === 'APPROACH') phase = 'APPROACH';
    else if (state.phase === 'LANDING') phase = 'LANDING';
    else if (['TAXI_OUT', 'TAXI_IN', 'LINEUP', 'PUSHBACK'].includes(state.phase)) phase = 'TAXI';
    else if (['TAKEOFF_ROLL', 'ROTATION'].includes(state.phase)) phase = 'TAKEOFF';

    return createAircraftState(
      {
        latitude: state.latitude,
        longitude: state.longitude,
        altitude: state.altitude,
        heading: state.heading,
        speed: state.groundSpeed,
      },
      center.lat,
      center.lon,
      phase
    );
  }, [simulation.isReady, simulation.state, simulation.sceneCenter]);

  const isNoGo = dispatchResult?.decision === 'NO-GO';
  const canSimulate = simulation.isReady && !isNoGo;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>✈️ Flight Planner Pro</h1>
        <p className={styles.headerSubtitle}>
          Professional Flight Planning & Simulation System
        </p>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Airport Upload */}
          <AirportUploader onUpload={handleAirportUpload} />

          {/* Flight Planning */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🗺️ Flight Planning</h3>
            
            <div className="space-y-4">
              <AirportSelector
                label="Departure"
                value={departureIcao}
                onChange={handleDepartureChange}
                airportCount={airportCount}
              />
              
              <AirportSelector
                label="Arrival"
                value={arrivalIcao}
                onChange={handleArrivalChange}
                airportCount={airportCount}
              />
              
              <AircraftSelector
                value={selectedAircraftCode}
                onChange={handleAircraftChange}
              />
              
              <button
                onClick={evaluateFlight}
                disabled={!departureAirport || !arrivalAirport || !selectedAircraft || isEvaluating}
                className={`${styles.button} ${styles.buttonPrimary} w-full`}
              >
                {isEvaluating ? 'Evaluating...' : '📋 Evaluate Flight'}
              </button>
            </div>
          </div>

          {/* Dispatch Decision */}
          <DispatchDisplay result={dispatchResult} isLoading={isEvaluating} />

          {/* Simulation Controls */}
          <SimulationControls
            isReady={canSimulate}
            isPlaying={simulation.state.isPlaying}
            progress={simulation.state.progress}
            phase={simulation.state.phase}
            speed={simulation.state.playbackSpeed}
            onPlay={simulation.play}
            onPause={simulation.pause}
            onStop={simulation.stop}
            onSeek={simulation.seek}
            onSpeedChange={simulation.setSpeed}
          />

          {/* Flight Info */}
          {simulation.isReady && <FlightInfo state={simulation.state} />}
        </aside>

        {/* 3D Scene */}
        <section className={styles.content}>
          <div className="bg-gray-800 rounded-lg overflow-hidden h-full relative">
            {/* Camera mode toggle */}
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

            {/* Scene */}
            <FlightScene
              aircraftState={aircraft3DState}
              routePoints={sceneData.routePoints}
              departurePosition={sceneData.departurePosition}
              arrivalPosition={sceneData.arrivalPosition}
              cameraMode={cameraMode}
              isNoGo={isNoGo}
            />

            {/* NO-GO Overlay */}
            {isNoGo && (
              <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center pointer-events-none">
                <div className="bg-red-800 px-8 py-4 rounded-lg border-2 border-red-500">
                  <h2 className="text-3xl font-bold text-white">❌ FLIGHT NOT FEASIBLE</h2>
                  <p className="text-red-200 text-center mt-2">See dispatch decision for details</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            {!route && !isNoGo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-gray-800/80 px-8 py-4 rounded-lg text-center">
                  <h2 className="text-xl text-gray-300">Select airports and aircraft to begin</h2>
                  <p className="text-gray-500 mt-2">Upload a CSV file with airport data first</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
