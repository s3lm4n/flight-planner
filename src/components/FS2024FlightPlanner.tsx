/**
 * FS2024-Style Flight Planner
 * 
 * This is the main application component with proper mode separation:
 * - PLANNING: Select airports, runways, aircraft
 * - SIMULATION: Run the flight with phase-based logic
 * 
 * KEY PRINCIPLES:
 * 1. Planning state is FROZEN when simulation starts
 * 2. Simulation receives an IMMUTABLE snapshot
 * 3. Map is a PASSIVE view (no validation logic)
 * 4. Validation is SEPARATE from rendering
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PassiveFlightMap } from '@/components/Map/PassiveFlightMap';
import { 
  parseAirportFile, 
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
import {
  AIRCRAFT_DATABASE,
  AircraftPerformance,
  getAircraft,
} from '@/services/dispatcher/dispatcherService';
import { fetchMetar, fetchTaf, DecodedMetar, DecodedTaf } from '@/api/aviationWeather';

// ============================================================================
// APP MODE
// ============================================================================

type AppMode = 'PLANNING' | 'SIMULATION';

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
  input: 'w-full border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:outline-none',
  button: 'px-4 py-2 rounded font-medium transition-colors',
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
  buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white',
  buttonDanger: 'bg-red-600 hover:bg-red-700 text-white',
  buttonDisabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  alert: 'p-3 rounded border',
  alertSuccess: 'bg-green-50 border-green-300 text-green-800',
  alertWarning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  alertError: 'bg-red-50 border-red-300 text-red-800',
  alertInfo: 'bg-blue-50 border-blue-300 text-blue-800',
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
// AIRPORT SELECTOR
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
    if (search.length >= 2) {
      if (airportCount > 0) {
        setSuggestions(airportDB.search(search, 10));
      } else {
        const matches = Object.values(builtInAirports)
          .filter(apt => 
            apt.icao.includes(search.toUpperCase()) ||
            apt.name.toUpperCase().includes(search.toUpperCase())
          )
          .slice(0, 10)
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
    
    // Check for exact match
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
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        disabled={disabled}
        className={`${styles.input} ${disabled ? 'bg-gray-100' : ''}`}
        placeholder="ICAO code"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(apt => (
            <li
              key={apt.icao}
              onClick={() => handleSelect(apt)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
            >
              <strong>{apt.icao}</strong> - {apt.name}
            </li>
          ))}
        </ul>
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
  const options = Object.entries(AIRCRAFT_DATABASE);
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Aircraft Type</label>
      <select
        value={value}
        onChange={(e) => {
          const ac = getAircraft(e.target.value);
          onChange(e.target.value, ac ?? null);
        }}
        disabled={disabled}
        className={`${styles.input} ${disabled ? 'bg-gray-100' : ''}`}
      >
        <option value="">Select aircraft</option>
        {options.map(([code, ac]) => (
          <option key={code} value={code}>
            {code} - {ac.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// VALIDATION WARNINGS PANEL
// ============================================================================

interface ValidationPanelProps {
  warnings: string[];
}

function ValidationPanel({ warnings }: ValidationPanelProps) {
  if (warnings.length === 0) return null;
  
  return (
    <div className={`${styles.alert} ${styles.alertWarning}`}>
      <div className="font-semibold mb-1">⚠️ Validation Warnings</div>
      <ul className="text-sm list-disc list-inside">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// METAR/TAF PANEL
// ============================================================================

interface WeatherPanelProps {
  departureIcao: string;
  arrivalIcao: string;
  departureMetar: DecodedMetar | null;
  arrivalMetar: DecodedMetar | null;
  departureTaf: DecodedTaf | null;
  arrivalTaf: DecodedTaf | null;
  isLoading: boolean;
  onRefresh: () => void;
}

function WeatherPanel({ 
  departureIcao, 
  arrivalIcao, 
  departureMetar, 
  arrivalMetar,
  departureTaf,
  arrivalTaf,
  isLoading, 
  onRefresh 
}: WeatherPanelProps) {
  const getCategoryColor = (cat: string | null) => {
    switch (cat) {
      case 'VFR': return 'text-green-600 bg-green-100';
      case 'MVFR': return 'text-blue-600 bg-blue-100';
      case 'IFR': return 'text-red-600 bg-red-100';
      case 'LIFR': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatWind = (metar: DecodedMetar | null) => {
    if (!metar) return '-';
    const dir = metar.wind.direction === 'VRB' ? 'VRB' : `${metar.wind.direction}°`;
    const gust = metar.wind.gust ? `G${metar.wind.gust}` : '';
    return `${dir}/${metar.wind.speed}${gust}kt`;
  };

  return (
    <div className={styles.card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={styles.cardTitle}>🌤️ METAR / TAF</h3>
        <button 
          onClick={onRefresh} 
          disabled={isLoading}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {isLoading ? '⏳' : '🔄'} Refresh
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Departure Weather */}
        {departureIcao && (
          <div className="border-l-4 border-green-500 pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-green-700">🛫 {departureIcao}</span>
              {departureMetar && (
                <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(departureMetar.flightCategory)}`}>
                  {departureMetar.flightCategory || 'N/A'}
                </span>
              )}
            </div>
            {departureMetar ? (
              <div className="text-xs space-y-1">
                <div className="font-mono bg-gray-50 p-1 rounded text-[10px] break-all">
                  {departureMetar.raw}
                </div>
                <div className="grid grid-cols-4 gap-2 text-gray-600">
                  <div><span className="text-gray-400">Wind:</span> {formatWind(departureMetar)}</div>
                  <div><span className="text-gray-400">Vis:</span> {departureMetar.visibility.value}sm</div>
                  <div><span className="text-gray-400">Temp:</span> {departureMetar.temperature}°C</div>
                  <div><span className="text-gray-400">QNH:</span> {departureMetar.altimeter.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400">No METAR available</div>
            )}
            {departureTaf && (
              <div className="mt-1 text-xs font-mono bg-blue-50 p-1 rounded text-[10px] break-all">
                {departureTaf.raw.slice(0, 200)}...
              </div>
            )}
          </div>
        )}
        
        {/* Arrival Weather */}
        {arrivalIcao && (
          <div className="border-l-4 border-blue-500 pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-blue-700">🛬 {arrivalIcao}</span>
              {arrivalMetar && (
                <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(arrivalMetar.flightCategory)}`}>
                  {arrivalMetar.flightCategory || 'N/A'}
                </span>
              )}
            </div>
            {arrivalMetar ? (
              <div className="text-xs space-y-1">
                <div className="font-mono bg-gray-50 p-1 rounded text-[10px] break-all">
                  {arrivalMetar.raw}
                </div>
                <div className="grid grid-cols-4 gap-2 text-gray-600">
                  <div><span className="text-gray-400">Wind:</span> {formatWind(arrivalMetar)}</div>
                  <div><span className="text-gray-400">Vis:</span> {arrivalMetar.visibility.value}sm</div>
                  <div><span className="text-gray-400">Temp:</span> {arrivalMetar.temperature}°C</div>
                  <div><span className="text-gray-400">QNH:</span> {arrivalMetar.altimeter.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400">No METAR available</div>
            )}
            {arrivalTaf && (
              <div className="mt-1 text-xs font-mono bg-blue-50 p-1 rounded text-[10px] break-all">
                {arrivalTaf.raw.slice(0, 200)}...
              </div>
            )}
          </div>
        )}
        
        {!departureIcao && !arrivalIcao && (
          <div className="text-sm text-gray-400 text-center py-4">
            Select airports to see weather
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FUEL PANEL
// ============================================================================

interface FuelPanelProps {
  route: FlightRoute | null;
  aircraft: AircraftPerformance | null;
}

function FuelPanel({ route, aircraft }: FuelPanelProps) {
  const fuelCalc = useMemo(() => {
    if (!route || !aircraft) return null;
    
    // Flight time calculations
    const flightTimeHrs = route.totalTime / 60;
    const climbTimeHrs = 0.25; // ~15 min climb
    const descentTimeHrs = 0.33; // ~20 min descent
    const cruiseTimeHrs = Math.max(0, flightTimeHrs - climbTimeHrs - descentTimeHrs);
    
    // Fuel burn rates (kg/hr) - use aircraft data or estimate
    const cruiseBurnRate = aircraft.fuelBurnCruise || 2500;
    const climbBurnRate = aircraft.fuelBurnClimb || cruiseBurnRate * 1.4;
    const descentBurnRate = aircraft.fuelBurnDescent || cruiseBurnRate * 0.5;
    
    // Fuel calculations
    const taxiFuel = 200; // kg
    const climbFuel = climbTimeHrs * climbBurnRate;
    const cruiseFuel = cruiseTimeHrs * cruiseBurnRate;
    const descentFuel = descentTimeHrs * descentBurnRate;
    const tripFuel = climbFuel + cruiseFuel + descentFuel;
    const contingencyFuel = tripFuel * 0.05; // 5%
    const alternateFuel = cruiseBurnRate * 0.5; // 30 min
    const holdingFuel = cruiseBurnRate * 0.75; // 45 min
    const finalReserve = cruiseBurnRate * 0.5; // 30 min
    
    const totalRequired = taxiFuel + tripFuel + contingencyFuel + alternateFuel + holdingFuel + finalReserve;
    const blockFuel = Math.ceil(totalRequired / 100) * 100; // Round up to nearest 100
    
    return {
      taxiFuel: Math.round(taxiFuel),
      tripFuel: Math.round(tripFuel),
      contingencyFuel: Math.round(contingencyFuel),
      alternateFuel: Math.round(alternateFuel),
      holdingFuel: Math.round(holdingFuel),
      finalReserve: Math.round(finalReserve),
      totalRequired: Math.round(totalRequired),
      blockFuel,
      flightTimeHrs,
    };
  }, [route, aircraft]);
  
  if (!fuelCalc) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>⛽ Fuel Calculation</h3>
        <div className="text-sm text-gray-400 text-center py-4">
          Complete flight plan to see fuel requirements
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>⛽ Fuel Calculation</h3>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-gray-600">Taxi Fuel:</div>
          <div className="font-mono text-right">{fuelCalc.taxiFuel.toLocaleString()} kg</div>
          
          <div className="text-gray-600">Trip Fuel:</div>
          <div className="font-mono text-right">{fuelCalc.tripFuel.toLocaleString()} kg</div>
          
          <div className="text-gray-600">Contingency (5%):</div>
          <div className="font-mono text-right">{fuelCalc.contingencyFuel.toLocaleString()} kg</div>
          
          <div className="text-gray-600">Alternate:</div>
          <div className="font-mono text-right">{fuelCalc.alternateFuel.toLocaleString()} kg</div>
          
          <div className="text-gray-600">Holding (45min):</div>
          <div className="font-mono text-right">{fuelCalc.holdingFuel.toLocaleString()} kg</div>
          
          <div className="text-gray-600">Final Reserve:</div>
          <div className="font-mono text-right">{fuelCalc.finalReserve.toLocaleString()} kg</div>
        </div>
        
        <div className="border-t pt-2 mt-2">
          <div className="grid grid-cols-2 gap-2 font-semibold">
            <div className="text-gray-800">Min Required:</div>
            <div className="font-mono text-right">{fuelCalc.totalRequired.toLocaleString()} kg</div>
            
            <div className="text-blue-800">Block Fuel:</div>
            <div className="font-mono text-right text-blue-800">{fuelCalc.blockFuel.toLocaleString()} kg</div>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 mt-2">
          Flight Time: {fuelCalc.flightTimeHrs.toFixed(1)} hrs
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROUTE INFO PANEL
// ============================================================================

interface RouteInfoPanelProps {
  route: FlightRoute | null;
  aircraft: AircraftPerformance | null;
  departureIcao: string;
  arrivalIcao: string;
}

function RouteInfoPanel({ route, aircraft, departureIcao, arrivalIcao }: RouteInfoPanelProps) {
  if (!route) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>📍 Route</h3>
        <div className="text-sm text-gray-400 text-center py-4">
          Select departure, arrival, and aircraft
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>📍 Route</h3>
      
      <div className="space-y-3">
        {/* Route summary */}
        <div className="flex items-center justify-between text-lg font-mono">
          <span className="text-green-700">{departureIcao}</span>
          <span className="text-gray-400">→</span>
          <span className="text-blue-700">{arrivalIcao}</span>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Distance</div>
            <div className="font-mono font-semibold">{route.totalDistance.toFixed(0)} nm</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Time</div>
            <div className="font-mono font-semibold">{Math.floor(route.totalTime / 60)}h {Math.round(route.totalTime % 60)}m</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Cruise</div>
            <div className="font-mono font-semibold">FL{Math.round((aircraft?.cruiseAltitudeFt || 35000) / 100)}</div>
          </div>
        </div>
        
        {/* Waypoints */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Route Waypoints</div>
          <div className="text-xs font-mono bg-gray-50 p-2 rounded break-all">
            {route.waypoints.map(wp => wp.name).join(' → ')}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS PAGE
// ============================================================================

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  airportCount: number;
  onAirportUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}

function SettingsPage({ isOpen, onClose, airportCount, onAirportUpload, disabled }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'databases' | 'simulation' | 'datasources' | 'advanced'>('databases');
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-100 z-50 overflow-auto">
      {/* Header */}
      <div className="bg-blue-900 p-4 border-b border-blue-800 sticky top-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-white">⚙️ Settings</h1>
            <p className="text-blue-200 text-sm">Configuration and data management</p>
          </div>
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded font-medium"
          >
            ← Back to Flight Planner
          </button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <nav className="w-56 shrink-0">
            <div className="bg-white rounded-lg shadow-md p-2 sticky top-24">
              <button
                onClick={() => setActiveTab('databases')}
                className={`w-full text-left px-4 py-3 rounded ${activeTab === 'databases' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
              >
                📁 Databases
              </button>
              <button
                onClick={() => setActiveTab('simulation')}
                className={`w-full text-left px-4 py-3 rounded ${activeTab === 'simulation' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
              >
                🎮 Simulation Engine
              </button>
              <button
                onClick={() => setActiveTab('datasources')}
                className={`w-full text-left px-4 py-3 rounded ${activeTab === 'datasources' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
              >
                🌐 Data Sources
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`w-full text-left px-4 py-3 rounded ${activeTab === 'advanced' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
              >
                🔧 Advanced
              </button>
            </div>
          </nav>
          
          {/* Content Area */}
          <div className="flex-1 space-y-4">
            {/* Databases Tab */}
            {activeTab === 'databases' && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">📁 Airport Database</h2>
                  <p className="text-gray-600 mb-4">
                    Upload a CSV file with airport data for extended global coverage beyond the built-in database.
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={onAirportUpload}
                    disabled={disabled}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 mb-3"
                  />
                  {airportCount > 0 ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800">
                      ✓ {airportCount.toLocaleString()} airports loaded from CSV
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-600">
                      Using built-in airport database (major international airports)
                    </div>
                  )}
                  <div className="mt-4 text-sm text-gray-500">
                    <strong>CSV Format:</strong> icao,name,latitude,longitude,elevation
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">🛤️ Runway Database</h2>
                  <p className="text-gray-600 mb-4">
                    Runway threshold coordinates, headings, and dimensions for realistic operations.
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
                    ✓ Built-in runway database active (major airports with precision data)
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">✈️ Aircraft Performance Database</h2>
                  <p className="text-gray-600 mb-4">
                    Aircraft performance data including weights, fuel burn, and V-speeds.
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
                    ✓ {Object.keys(AIRCRAFT_DATABASE).length} aircraft types available
                  </div>
                </div>
              </>
            )}
            
            {/* Simulation Engine Tab */}
            {activeTab === 'simulation' && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">🎮 Flight Simulation Engine</h2>
                  <p className="text-gray-600 mb-4">
                    Phase-based simulation with realistic flight dynamics.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Simulation Architecture</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• <strong>Immutable Snapshot:</strong> Planning state freezes when simulation starts</li>
                        <li>• <strong>Phase-Driven:</strong> Transitions based on V-speeds, altitude, distance</li>
                        <li>• <strong>1D Runway Motion:</strong> Ground roll follows runway centerline exactly</li>
                        <li>• <strong>Great Circle:</strong> Enroute navigation uses spherical geometry</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Flight Phases</h3>
                      <div className="text-xs font-mono text-gray-600 bg-white p-2 rounded">
                        LINEUP → TAKEOFF_ROLL → V1 → ROTATE → LIFTOFF → INITIAL_CLIMB →<br/>
                        CLIMB → CRUISE → DESCENT → APPROACH → FINAL → LANDING → TAXI_IN
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Time Scale</h3>
                      <p className="text-sm text-gray-600">
                        1 real second = 1 simulated minute (60x speed base)
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Playback speed: 0.25x to 4x adjustable during simulation
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Data Sources Tab */}
            {activeTab === 'datasources' && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">🌐 Weather Data Sources</h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                      <div>
                        <div className="font-medium">AviationWeather.gov (AWC)</div>
                        <div className="text-sm text-gray-600">Official NOAA METAR/TAF data</div>
                      </div>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Active</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded opacity-60">
                      <div>
                        <div className="font-medium">CheckWX API</div>
                        <div className="text-sm text-gray-600">Alternative weather source</div>
                      </div>
                      <span className="px-2 py-1 bg-gray-400 text-white text-xs rounded">Disabled</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">📊 Navigation Data</h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                      <div>
                        <div className="font-medium">Built-in Navigation Database</div>
                        <div className="text-sm text-gray-600">Airways, waypoints, procedures</div>
                      </div>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Active</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded opacity-60">
                      <div>
                        <div className="font-medium">OpenAIP</div>
                        <div className="text-sm text-gray-600">Community aviation data</div>
                      </div>
                      <span className="px-2 py-1 bg-gray-400 text-white text-xs rounded">Optional</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">🗺️ Map Tiles</h2>
                  
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="font-medium">OpenStreetMap</div>
                    <div className="text-sm text-gray-600">Free map tiles for visualization</div>
                  </div>
                </div>
              </>
            )}
            
            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">🔧 Technical Options</h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Debug Mode</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Enable console logging for simulation state and phase transitions.
                      </p>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Enable debug logging</span>
                      </label>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Performance</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Map update frequency during simulation.
                      </p>
                      <select className="w-full border rounded px-3 py-2">
                        <option>Update on phase change only (recommended)</option>
                        <option>Update every second</option>
                        <option>Update every frame (60fps)</option>
                      </select>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded border">
                      <h3 className="font-medium mb-2">Units</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="text-gray-600">Distance</label>
                          <select className="w-full border rounded px-2 py-1 mt-1">
                            <option>Nautical Miles (nm)</option>
                            <option>Kilometers (km)</option>
                            <option>Statute Miles (sm)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-600">Altitude</label>
                          <select className="w-full border rounded px-2 py-1 mt-1">
                            <option>Feet (ft)</option>
                            <option>Meters (m)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-600">Speed</label>
                          <select className="w-full border rounded px-2 py-1 mt-1">
                            <option>Knots (kts)</option>
                            <option>km/h</option>
                            <option>mph</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-600">Fuel</label>
                          <select className="w-full border rounded px-2 py-1 mt-1">
                            <option>Kilograms (kg)</option>
                            <option>Pounds (lbs)</option>
                            <option>US Gallons</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold mb-4">ℹ️ About</h2>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Flight Planner</strong> - Professional EFB Dispatcher</p>
                    <p>Phase-based simulation with FS2024-style accuracy</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Architecture: Immutable snapshots • 1D runway motion • Great circle navigation
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SIMULATION CONTROLS
// ============================================================================

interface SimulationControlsProps {
  mode: AppMode;
  canStart: boolean;
  simulation: ReturnType<typeof usePhaseSimulation>;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
}

function SimulationControls({ mode, canStart, simulation, onStartSimulation, onStopSimulation }: SimulationControlsProps) {
  if (mode === 'PLANNING') {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>▶️ Start Flight</h3>
        <button
          onClick={onStartSimulation}
          disabled={!canStart}
          className={`${styles.button} w-full ${canStart ? styles.buttonSuccess : styles.buttonDisabled}`}
        >
          {canStart ? 'Start Simulation' : 'Complete flight plan first'}
        </button>
      </div>
    );
  }
  
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>🎮 Simulation Controls</h3>
      
      {/* Phase indicator */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <div className="text-xs text-gray-500">Current Phase</div>
        <div className="text-lg font-bold text-blue-800">
          {getPhaseName(simulation.state.phase)}
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => simulation.state.isPlaying && !simulation.state.isPaused ? simulation.pause() : simulation.play()}
          className={`${styles.button} flex-1 ${styles.buttonPrimary}`}
        >
          {simulation.state.isPlaying && !simulation.state.isPaused ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={onStopSimulation}
          className={`${styles.button} ${styles.buttonDanger}`}
        >
          ⏹ Stop
        </button>
      </div>
      
      {/* Speed control */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Speed: {simulation.state.playbackSpeed}x
        </label>
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
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Ground Speed</div>
          <div className="font-mono">{simulation.state.groundSpeedKts.toFixed(0)} kts</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Altitude</div>
          <div className="font-mono">{simulation.state.altitudeFt.toFixed(0)} ft</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Heading</div>
          <div className="font-mono">{simulation.state.headingTrue.toFixed(0)}°</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">VS</div>
          <div className="font-mono">{simulation.state.verticalSpeedFpm.toFixed(0)} fpm</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FS2024FlightPlanner() {
  // App mode
  const [mode, setMode] = useState<AppMode>('PLANNING');
  
  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  
  // Planning state
  const [airportCount, setAirportCount] = useState(0);
  const [departureIcao, setDepartureIcao] = useState('');
  const [arrivalIcao, setArrivalIcao] = useState('');
  const [departureAirport, setDepartureAirport] = useState<CSVAirport | null>(null);
  const [arrivalAirport, setArrivalAirport] = useState<CSVAirport | null>(null);
  const [departureRunways, setDepartureRunways] = useState<Runway[]>([]);
  const [arrivalRunways, setArrivalRunways] = useState<Runway[]>([]);
  const [departureSelectedRunway, setDepartureSelectedRunway] = useState<SelectedRunway | null>(null);
  const [arrivalSelectedRunway, setArrivalSelectedRunway] = useState<SelectedRunway | null>(null);
  const [aircraftCode, setAircraftCode] = useState('');
  const [aircraft, setAircraft] = useState<AircraftPerformance | null>(null);
  const [route, setRoute] = useState<FlightRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  // Weather state
  const [departureMetar, setDepartureMetar] = useState<DecodedMetar | null>(null);
  const [arrivalMetar, setArrivalMetar] = useState<DecodedMetar | null>(null);
  const [departureTaf, setDepartureTaf] = useState<DecodedTaf | null>(null);
  const [arrivalTaf, setArrivalTaf] = useState<DecodedTaf | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  
  // Frozen snapshot (IMMUTABLE once created)
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  
  // Phase-based simulation
  const simulation = usePhaseSimulation();
  
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
  
  // Fetch weather when airports change
  const fetchWeather = useCallback(async () => {
    const icaos: string[] = [];
    if (departureIcao.length === 4) icaos.push(departureIcao);
    if (arrivalIcao.length === 4) icaos.push(arrivalIcao);
    
    if (icaos.length === 0) return;
    
    setWeatherLoading(true);
    try {
      // Fetch METAR
      const metars = await fetchMetar(icaos);
      const depMetar = metars.find(m => m.icao === departureIcao) || null;
      const arrMetar = metars.find(m => m.icao === arrivalIcao) || null;
      setDepartureMetar(depMetar);
      setArrivalMetar(arrMetar);
      
      // Fetch TAF
      const tafs = await fetchTaf(icaos);
      const depTaf = tafs.find(t => t.icao === departureIcao) || null;
      const arrTaf = tafs.find(t => t.icao === arrivalIcao) || null;
      setDepartureTaf(depTaf);
      setArrivalTaf(arrTaf);
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setWeatherLoading(false);
    }
  }, [departureIcao, arrivalIcao]);
  
  // Auto-fetch weather when airports change
  useEffect(() => {
    if (departureIcao.length === 4 || arrivalIcao.length === 4) {
      fetchWeather();
    }
  }, [departureIcao, arrivalIcao, fetchWeather]);
  
  // Generate route when all selections are made
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
        setRouteError(error instanceof Error ? error.message : 'Route generation failed');
        setRoute(null);
      }
    }
  }, [mode, departureAirport, arrivalAirport, departureSelectedRunway, arrivalSelectedRunway, aircraft]);
  
  // Validation warnings
  const validationWarnings = useMemo(() => {
    if (mode === 'SIMULATION') return [];
    
    const warnings: string[] = [];
    
    if (!departureAirport) {
      warnings.push('Select departure airport');
    } else if (departureRunways.length === 0) {
      warnings.push(`No runway data for ${departureIcao}`);
    } else if (!departureSelectedRunway) {
      warnings.push('Select departure runway');
    }
    
    if (!arrivalAirport) {
      warnings.push('Select arrival airport');
    } else if (arrivalRunways.length === 0) {
      warnings.push(`No runway data for ${arrivalIcao}`);
    } else if (!arrivalSelectedRunway) {
      warnings.push('Select arrival runway');
    }
    
    if (!aircraft) {
      warnings.push('Select aircraft type');
    }
    
    return warnings;
  }, [mode, departureAirport, arrivalAirport, departureRunways, arrivalRunways, departureSelectedRunway, arrivalSelectedRunway, aircraft, departureIcao, arrivalIcao]);
  
  // Can start simulation?
  const canStartSimulation = useMemo(() => {
    return route !== null && validationWarnings.length === 0;
  }, [route, validationWarnings]);
  
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
  
  // Start simulation
  const handleStartSimulation = useCallback(() => {
    if (!canStartSimulation || !route || !departureSelectedRunway || !arrivalSelectedRunway || !aircraft) {
      return;
    }
    
    try {
      // Create FROZEN snapshot
      const planningState: PlanningStateForSnapshot = {
        departureIcao,
        arrivalIcao,
        departureRunway: departureSelectedRunway,
        arrivalRunway: arrivalSelectedRunway,
        aircraft,
        route,
      };
      
      const newSnapshot = createSimulationSnapshot(planningState);
      setSnapshot(newSnapshot);
      simulation.loadSnapshot(newSnapshot);
      setMode('SIMULATION');
    } catch (error) {
      console.error('Failed to create simulation snapshot:', error);
      setRouteError(error instanceof Error ? error.message : 'Failed to start simulation');
    }
  }, [canStartSimulation, route, departureIcao, arrivalIcao, departureSelectedRunway, arrivalSelectedRunway, aircraft, simulation]);
  
  // Stop simulation
  const handleStopSimulation = useCallback(() => {
    simulation.stop();
    setSnapshot(null);
    setMode('PLANNING');
  }, [simulation]);
  
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
  
  const handleAirportUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await parseAirportFile(file);
    if (result.success) {
      airportDB.load(result);
      setAirportCount(result.validRows);
    }
  }, []);

  return (
    <div className={styles.container}>
      {/* Settings Page (Full Screen) */}
      <SettingsPage
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        airportCount={airportCount}
        onAirportUpload={handleAirportUpload}
        disabled={mode === 'SIMULATION'}
      />
      
      {/* Header */}
      <header className={styles.header}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={styles.headerTitle}>✈️ Flight Planner</h1>
            <p className={styles.headerSubtitle}>
              Professional dispatch • METAR/TAF • Fuel planning
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded bg-white/20 text-white font-mono text-sm">
              {mode}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded hover:bg-white/10 text-white"
              title="Settings"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                <path d="M12.475 8l1.86-1.798-1.62-2.804-2.435.697L9.627 1.5h-3.25L5.75 4.095 3.3 3.398 1.68 6.204l1.87 1.807-1.87 1.81 1.62 2.806 2.45-.7.637 2.572h3.25l.643-2.565 2.465.705 1.622-2.805L12.475 8zm-.225 3.453l-2.183-.628-.67.463-.55 2.212h-1.68l-.55-2.2-.647-.475-2.195.628L2.935 10 4.57 8.42v-.81L2.935 6.027l.84-1.455 2.197.63.648-.517.547-2.185h1.68l.55 2.195.645.518 2.208-.64.84 1.454-1.638 1.583.025.808L13.1 10l-.85 1.453z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="flex flex-col lg:flex-row gap-4 p-4">
        {/* Left Sidebar - Flight Planning */}
        <aside className="lg:w-[350px] space-y-4">
          {/* Flight Planning */}
          <div className={`${styles.card} ${mode === 'SIMULATION' ? 'opacity-60' : ''}`}>
            <h3 className={styles.cardTitle}>🗺️ Flight Plan</h3>
            
            <div className="space-y-4">
              {/* Departure */}
              <div className="border-l-4 border-green-500 pl-3 space-y-2">
                <div className="text-sm font-medium text-green-700">🛫 Departure</div>
                <AirportSelector
                  label="Airport"
                  value={departureIcao}
                  onChange={handleDepartureChange}
                  airportCount={airportCount}
                  disabled={mode === 'SIMULATION'}
                />
                <RunwaySelector
                  label="Runway"
                  runways={departureRunways}
                  selectedRunway={departureSelectedRunway}
                  onSelect={setDepartureSelectedRunway}
                  disabled={mode === 'SIMULATION' || !departureAirport}
                  requiredLength={aircraft?.takeoffDistanceM ? aircraft.takeoffDistanceM * 3.28084 : 0}
                />
              </div>
              
              {/* Arrival */}
              <div className="border-l-4 border-blue-500 pl-3 space-y-2">
                <div className="text-sm font-medium text-blue-700">🛬 Arrival</div>
                <AirportSelector
                  label="Airport"
                  value={arrivalIcao}
                  onChange={handleArrivalChange}
                  airportCount={airportCount}
                  disabled={mode === 'SIMULATION'}
                />
                <RunwaySelector
                  label="Runway"
                  runways={arrivalRunways}
                  selectedRunway={arrivalSelectedRunway}
                  onSelect={setArrivalSelectedRunway}
                  disabled={mode === 'SIMULATION' || !arrivalAirport}
                  requiredLength={aircraft?.landingDistanceM ? aircraft.landingDistanceM * 3.28084 : 0}
                />
              </div>
              
              {/* Aircraft */}
              <AircraftSelector
                value={aircraftCode}
                onChange={handleAircraftChange}
                disabled={mode === 'SIMULATION'}
              />
              
              {routeError && (
                <div className={`${styles.alert} ${styles.alertError}`}>
                  {routeError}
                </div>
              )}
            </div>
          </div>
          
          {/* Validation Warnings */}
          <ValidationPanel warnings={validationWarnings} />
          
          {/* Simulation Controls */}
          <SimulationControls
            mode={mode}
            canStart={canStartSimulation}
            simulation={simulation}
            onStartSimulation={handleStartSimulation}
            onStopSimulation={handleStopSimulation}
          />
        </aside>

        {/* Center - Map */}
        <section className="flex-1 min-w-0">
          <PassiveFlightMap
            snapshot={snapshot}
            output={simulation.isReady ? simulation.output : null}
            routeCoordinates={routeCoordinates}
          />
        </section>
        
        {/* Right Sidebar - Info Panels */}
        <aside className="lg:w-[350px] space-y-4">
          {/* Route Info */}
          <RouteInfoPanel
            route={route}
            aircraft={aircraft}
            departureIcao={departureIcao}
            arrivalIcao={arrivalIcao}
          />
          
          {/* Weather Panel */}
          <WeatherPanel
            departureIcao={departureIcao}
            arrivalIcao={arrivalIcao}
            departureMetar={departureMetar}
            arrivalMetar={arrivalMetar}
            departureTaf={departureTaf}
            arrivalTaf={arrivalTaf}
            isLoading={weatherLoading}
            onRefresh={fetchWeather}
          />
          
          {/* Fuel Panel */}
          <FuelPanel route={route} aircraft={aircraft} />
          
          {/* V-speeds info when in simulation */}
          {snapshot && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📊 V-Speeds</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">V1</div>
                  <div className="font-mono font-bold">{snapshot.aircraft.v1}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">VR</div>
                  <div className="font-mono font-bold">{snapshot.aircraft.vR}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">V2</div>
                  <div className="font-mono font-bold">{snapshot.aircraft.v2}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">VRef</div>
                  <div className="font-mono font-bold">{snapshot.aircraft.vRef}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default FS2024FlightPlanner;
