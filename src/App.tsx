/**
 * Main Application Component
 * 
 * Flight Planning and Visualization System
 * Integrates all components for a complete EFB experience.
 * 
 * UPDATED: Uses simple simulation engine and AviationWeather.gov API
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useFlightStore } from '@/store/flightStore';
import { FlightMap } from '@/components/Map';
import { LayerControl } from '@/components/Map/LayerControl';
import { 
  AirportSelector, 
  AircraftSelector, 
  FlightPlanPanel,
  AviationWeatherPanel,
  DispatchPanel,
} from '@/components/UI';
import { useSimpleSimulation } from '@/hooks/useSimpleSimulation';
import { generateFlightPlan } from '@/utils/routeCalculator';
import { buildCompleteRouteGeoJSON } from '@/utils/geojson';
import { RouteSegmentType, FlightPlan } from '@/types';
import { formatDistance } from '@/utils/aviation';
import { AirportWeather } from '@/api/aviationWeather';

// ============================================================================
// SIMULATION CONTROLS COMPONENT
// ============================================================================

interface SimulationControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  progress: number;
  speed: number;
  elapsedTimeFormatted: string;
  etaFormatted: string;
  distanceCovered: number;
  distanceRemaining: number;
  phaseLabel: string;
  groundSpeed: number;
  altitude: number;
  currentLegIndex: number;
  totalLegs: number;
  flightPlan: FlightPlan | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50];

const SimulationControls: React.FC<SimulationControlsProps> = ({
  isRunning,
  isPaused,
  isComplete,
  progress,
  speed,
  elapsedTimeFormatted,
  etaFormatted,
  distanceCovered,
  distanceRemaining,
  phaseLabel,
  groundSpeed,
  altitude,
  currentLegIndex,
  totalLegs,
  flightPlan,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSpeedChange,
}) => {
  if (!flightPlan) return null;

  const progressPercent = (progress * 100).toFixed(1);
  const currentLeg = flightPlan.legs[currentLegIndex];

  return (
    <div className="simulation-controls bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          ✈️ Flight Simulation
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            isComplete ? 'bg-green-500' : 
            isRunning && !isPaused ? 'bg-yellow-500' : 'bg-gray-500'
          } text-white`}>
            {isComplete ? 'COMPLETED' : isRunning && !isPaused ? 'RUNNING' : 'STOPPED'}
          </span>
          <span className="text-purple-100 text-sm">{phaseLabel}</span>
        </div>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{elapsedTimeFormatted}</span>
            <span>{progressPercent}%</span>
            <span>ETA: {etaFormatted}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatDistance(distanceCovered)}</span>
            <span>{formatDistance(distanceRemaining)} remaining</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {/* Stop/Reset button */}
          <button
            onClick={onStop}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Reset to start"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
            </svg>
          </button>

          {/* Play/Pause button */}
          <button
            onClick={isRunning && !isPaused ? onPause : onPlay}
            disabled={isComplete}
            className="p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRunning && !isPaused ? 'Pause' : 'Play'}
          >
            {isRunning && !isPaused ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip to end */}
          <button
            onClick={() => onSeek(1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Skip to end"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Speed:</span>
          <div className="flex gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  speed === s
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Flight info */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Altitude</div>
            <div className="font-bold text-purple-600">FL{Math.round(altitude / 100)}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Ground Speed</div>
            <div className="font-bold text-purple-600">{Math.round(groundSpeed)} kt</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">Phase</div>
            <div className="font-bold text-purple-600">{phaseLabel}</div>
          </div>
        </div>

        {/* Current leg info */}
        {currentLeg && (
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">
              Current Leg ({currentLegIndex + 1} of {totalLegs})
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-purple-600">
                  {currentLeg.from.id}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-mono font-bold text-purple-600">
                  {currentLeg.to.id}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {currentLeg.segmentType}
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>{formatDistance(currentLeg.distance)}</span>
              <span>HDG {Math.round(currentLeg.course)}°</span>
            </div>
          </div>
        )}

        {/* Leg progress indicator */}
        <div className="mt-3">
          <div className="flex gap-1">
            {flightPlan.legs.map((leg, index) => (
              <div
                key={index}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  index < currentLegIndex
                    ? 'bg-purple-600'
                    : index === currentLegIndex
                    ? 'bg-purple-400'
                    : 'bg-gray-200'
                }`}
                title={`${leg.from.id} → ${leg.to.id}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  // Store state
  const {
    departureAirport,
    arrivalAirport,
    selectedAircraft,
    flightPlan,
    routeGeoJSON,
    layers,
    isGeneratingPlan,
    setDepartureAirport,
    setArrivalAirport,
    setSelectedAircraft,
    setFlightPlan,
    setRouteGeoJSON,
    toggleLayer,
    setAllLayers,
    setIsGeneratingPlan,
  } = useFlightStore();

  // Weather state for dispatch
  const [departureWeather, setDepartureWeather] = useState<AirportWeather | null>(null);
  const [arrivalWeather, setArrivalWeather] = useState<AirportWeather | null>(null);

  // Weather update handler
  const handleWeatherUpdate = useCallback((depWx: AirportWeather | null, arrWx: AirportWeather | null) => {
    setDepartureWeather(depWx);
    setArrivalWeather(arrWx);
  }, []);

  // Use the simple simulation hook
  const simulation = useSimpleSimulation({
    flightPlan,
    onComplete: () => {
      console.log('Flight completed!');
    },
    onPhaseChange: (phase, prevPhase) => {
      console.log(`Phase changed: ${prevPhase} → ${phase}`);
    },
    onLegChange: (legIndex, leg) => {
      console.log(`Now on leg ${legIndex + 1}: ${leg.from.id} → ${leg.to.id}`);
    },
  });

  // Generate flight plan
  const handleGenerateFlightPlan = useCallback(async () => {
    if (!departureAirport || !arrivalAirport || !selectedAircraft) return;

    setIsGeneratingPlan(true);

    try {
      // Simulate some async work
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate the flight plan
      const plan = generateFlightPlan(departureAirport, arrivalAirport, selectedAircraft);
      setFlightPlan(plan);

      // Build route GeoJSON
      const geoJSON = buildCompleteRouteGeoJSON(plan);
      setRouteGeoJSON(geoJSON);

      // Simulation will auto-initialize when flightPlan changes

    } catch (error) {
      console.error('Failed to generate flight plan:', error);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [departureAirport, arrivalAirport, selectedAircraft, setFlightPlan, setRouteGeoJSON, setIsGeneratingPlan]);

  // Auto-generate flight plan when all inputs are selected
  useEffect(() => {
    if (departureAirport && arrivalAirport && selectedAircraft && !flightPlan) {
      handleGenerateFlightPlan();
    }
  }, [departureAirport, arrivalAirport, selectedAircraft, flightPlan, handleGenerateFlightPlan]);

  // Layer toggle handlers
  const handleToggleLayer = useCallback((layer: RouteSegmentType) => {
    toggleLayer(layer);
  }, [toggleLayer]);

  const handleToggleAllLayers = useCallback((visible: boolean) => {
    setAllLayers(visible);
  }, [setAllLayers]);

  // Clear all and start over
  const handleClearAll = useCallback(() => {
    simulation.stop();
    setDepartureAirport(null);
    setArrivalAirport(null);
    setSelectedAircraft(null);
    setFlightPlan(null);
    setRouteGeoJSON(null);
  }, [
    simulation,
    setDepartureAirport,
    setArrivalAirport,
    setSelectedAircraft,
    setFlightPlan,
    setRouteGeoJSON,
  ]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-900 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✈️</span>
              <div>
                <h1 className="text-2xl font-bold text-white">Flight Planner</h1>
                <p className="text-blue-200 text-sm">Professional Flight Planning System</p>
              </div>
            </div>

            {flightPlan && (
              <div className="flex items-center gap-4">
                <div className="text-white text-center">
                  <div className="text-2xl font-bold">
                    {flightPlan.departure.icao}
                    <span className="mx-2 text-blue-300">→</span>
                    {flightPlan.arrival.icao}
                  </div>
                  <div className="text-sm text-blue-200">
                    {flightPlan.aircraft?.name}
                  </div>
                </div>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  New Flight
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar - Selection panels */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            {/* Airport selectors */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                🗺️ Route Selection
              </h2>

              <div className="space-y-4">
                <AirportSelector
                  label="Departure Airport"
                  selectedAirport={departureAirport}
                  onSelect={setDepartureAirport}
                  excludeIcao={arrivalAirport?.icao}
                  placeholder="Enter ICAO (e.g., LTFM)"
                  icon={<span className="text-green-600">🛫</span>}
                />

                <AirportSelector
                  label="Arrival Airport"
                  selectedAirport={arrivalAirport}
                  onSelect={setArrivalAirport}
                  excludeIcao={departureAirport?.icao}
                  placeholder="Enter ICAO (e.g., EGLL)"
                  icon={<span className="text-red-600">🛬</span>}
                />
              </div>
            </div>

            {/* Aircraft selector */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                ✈️ Aircraft
              </h2>

              <AircraftSelector
                selectedAircraft={selectedAircraft}
                onSelect={setSelectedAircraft}
              />
            </div>

            {/* Weather panel - using AviationWeather.gov */}
            <AviationWeatherPanel
              departureAirport={departureAirport}
              arrivalAirport={arrivalAirport}
              onWeatherUpdate={handleWeatherUpdate}
            />

            {/* Dispatch Panel - Professional dispatch decision */}
            {flightPlan && (
              <DispatchPanel
                flightPlan={flightPlan}
                departureAirport={departureAirport}
                arrivalAirport={arrivalAirport}
                departureWeather={departureWeather?.metar || null}
                arrivalWeather={arrivalWeather?.metar || null}
              />
            )}
          </aside>

          {/* Center - Map */}
          <section className="col-span-12 lg:col-span-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <FlightMap
                routeGeoJSON={routeGeoJSON}
                layers={layers}
                aircraftPosition={simulation.position}
                aircraftHeading={simulation.heading}
                animationState={{
                  isPlaying: simulation.isRunning,
                  isPaused: simulation.isPaused,
                  progress: simulation.progress,
                  currentLegIndex: simulation.currentLegIndex,
                  speed: simulation.speed,
                }}
                flightPlan={flightPlan}
                groundSpeed={simulation.groundSpeed}
                altitude={simulation.altitude}
              />
            </div>

            {/* Layer control */}
            {routeGeoJSON && (
              <div className="mt-4">
                <LayerControl
                  layers={layers}
                  onToggleLayer={handleToggleLayer}
                  onToggleAll={handleToggleAllLayers}
                />
              </div>
            )}

            {/* Simulation controls */}
            {flightPlan && (
              <div className="mt-4">
                <SimulationControls
                  isRunning={simulation.isRunning}
                  isPaused={simulation.isPaused}
                  isComplete={simulation.isComplete}
                  progress={simulation.progress}
                  speed={simulation.speed}
                  elapsedTimeFormatted={simulation.elapsedTimeFormatted}
                  etaFormatted={simulation.etaFormatted}
                  distanceCovered={simulation.distanceCovered}
                  distanceRemaining={simulation.distanceRemaining}
                  phaseLabel={simulation.phaseLabel}
                  groundSpeed={simulation.groundSpeed}
                  altitude={simulation.altitude}
                  currentLegIndex={simulation.currentLegIndex}
                  totalLegs={flightPlan.legs.length}
                  flightPlan={flightPlan}
                  onPlay={simulation.play}
                  onPause={simulation.pause}
                  onStop={simulation.stop}
                  onSeek={simulation.seekTo}
                  onSpeedChange={simulation.setSpeed}
                />
              </div>
            )}
          </section>

          {/* Right sidebar - Flight plan */}
          <aside className="col-span-12 lg:col-span-3">
            <FlightPlanPanel
              flightPlan={flightPlan}
              isGenerating={isGeneratingPlan}
              onGeneratePlan={handleGenerateFlightPlan}
            />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>Flight Planner — Production-quality flight planning and visualization system</p>
          <p className="mt-1 text-gray-500">
            Weather data from AviationWeather.gov • Maps from OpenStreetMap • 
            All distances in nautical miles, altitudes in feet, speeds in knots
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
