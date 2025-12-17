/**
 * Main Application Component
 * 
 * Flight Planning and Visualization System
 * Integrates all components for a complete EFB experience.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useFlightStore } from '@/store/flightStore';
import { FlightMap } from '@/components/Map';
import { LayerControl } from '@/components/Map/LayerControl';
import { 
  AirportSelector, 
  AircraftSelector, 
  WeatherPanel, 
  FlightPlanPanel,
  AnimationControls,
} from '@/components/UI';
import { useAnimation, extractWindFromMetar } from '@/hooks/useAnimation';
import { fetchAirportWeather } from '@/api/weather';
import { generateFlightPlan } from '@/utils/routeCalculator';
import { buildCompleteRouteGeoJSON } from '@/utils/geojson';
import { Coordinate, RouteSegmentType } from '@/types';

const App: React.FC = () => {
  // Store state
  const {
    departureAirport,
    arrivalAirport,
    selectedAircraft,
    departureWeather,
    arrivalWeather,
    flightPlan,
    routeGeoJSON,
    animation,
    layers,
    isLoadingWeather,
    isGeneratingPlan,
    setDepartureAirport,
    setArrivalAirport,
    setSelectedAircraft,
    setDepartureWeather,
    setArrivalWeather,
    setFlightPlan,
    setRouteGeoJSON,
    setAnimation,
    toggleLayer,
    setAllLayers,
    setIsLoadingWeather,
    setIsGeneratingPlan,
  } = useFlightStore();
  
  // Local state for aircraft position
  const [aircraftPosition, setAircraftPosition] = useState<Coordinate | null>(null);
  const [aircraftHeading, setAircraftHeading] = useState<number>(0);
  const [groundSpeed, setGroundSpeed] = useState<number>(0);
  const [altitude, setAltitude] = useState<number>(0);
  
  // Get wind data from departure weather
  const wind = departureWeather?.metar ? extractWindFromMetar(departureWeather.metar) : null;
  
  // Animation hook
  const { updatePositionAtProgress, getInitialPosition } = useAnimation({
    flightPlan,
    animationState: animation,
    wind,
    onPositionUpdate: (position, heading, gs, alt) => {
      setAircraftPosition(position);
      setAircraftHeading(heading);
      setGroundSpeed(gs);
      setAltitude(alt);
    },
    onProgressUpdate: (progress, legIndex) => {
      setAnimation({
        progress,
        currentLegIndex: legIndex,
      });
    },
    onComplete: () => {
      setAnimation({
        isPlaying: false,
        isPaused: false,
        progress: 1,
      });
    },
  });
  
  // Initialize aircraft position when flight plan is generated
  useEffect(() => {
    if (flightPlan && !aircraftPosition) {
      const initial = getInitialPosition();
      if (initial) {
        setAircraftPosition(initial);
        // Set initial heading towards first waypoint
        if (flightPlan.legs.length > 0) {
          setAircraftHeading(flightPlan.legs[0].course);
          setGroundSpeed(flightPlan.legs[0].groundSpeed);
          setAltitude(flightPlan.legs[0].altitude);
        }
      }
    }
  }, [flightPlan, aircraftPosition, getInitialPosition]);
  
  // Fetch weather for airports
  const handleFetchWeather = useCallback(async () => {
    const icaos: string[] = [];
    if (departureAirport) icaos.push(departureAirport.icao);
    if (arrivalAirport) icaos.push(arrivalAirport.icao);
    
    if (icaos.length === 0) return;
    
    setIsLoadingWeather(true);
    
    try {
      const weatherPromises = icaos.map(icao => fetchAirportWeather(icao));
      const results = await Promise.all(weatherPromises);
      
      if (departureAirport && results[0]) {
        setDepartureWeather(results[0]);
      }
      if (arrivalAirport && results[icaos.indexOf(arrivalAirport.icao)]) {
        setArrivalWeather(results[icaos.indexOf(arrivalAirport.icao)]);
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  }, [departureAirport, arrivalAirport, setDepartureWeather, setArrivalWeather, setIsLoadingWeather]);
  
  // Auto-fetch weather when airports change
  useEffect(() => {
    if (departureAirport || arrivalAirport) {
      handleFetchWeather();
    }
  }, [departureAirport?.icao, arrivalAirport?.icao]);
  
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
      
      // Reset animation
      setAnimation({
        isPlaying: false,
        isPaused: false,
        progress: 0,
        currentLegIndex: 0,
        speed: 1,
      });
      
      // Set initial aircraft position
      setAircraftPosition({
        lat: departureAirport.position.lat,
        lon: departureAirport.position.lon,
      });
      
    } catch (error) {
      console.error('Failed to generate flight plan:', error);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [departureAirport, arrivalAirport, selectedAircraft, setFlightPlan, setRouteGeoJSON, setAnimation, setIsGeneratingPlan]);
  
  // Auto-generate flight plan when all inputs are selected
  useEffect(() => {
    if (departureAirport && arrivalAirport && selectedAircraft && !flightPlan) {
      handleGenerateFlightPlan();
    }
  }, [departureAirport, arrivalAirport, selectedAircraft, flightPlan, handleGenerateFlightPlan]);
  
  // Animation controls
  const handlePlay = useCallback(() => {
    setAnimation({ isPlaying: true, isPaused: false });
  }, [setAnimation]);
  
  const handlePause = useCallback(() => {
    setAnimation({ isPaused: true });
  }, [setAnimation]);
  
  const handleReset = useCallback(() => {
    setAnimation({
      isPlaying: false,
      isPaused: false,
      progress: 0,
      currentLegIndex: 0,
    });
    const initial = getInitialPosition();
    if (initial) {
      setAircraftPosition(initial);
    }
  }, [setAnimation, getInitialPosition]);
  
  const handleSpeedChange = useCallback((speed: number) => {
    setAnimation({ speed });
  }, [setAnimation]);
  
  const handleProgressChange = useCallback((progress: number) => {
    updatePositionAtProgress(progress);
  }, [updatePositionAtProgress]);
  
  // Layer toggle handlers
  const handleToggleLayer = useCallback((layer: RouteSegmentType) => {
    toggleLayer(layer);
  }, [toggleLayer]);
  
  const handleToggleAllLayers = useCallback((visible: boolean) => {
    setAllLayers(visible);
  }, [setAllLayers]);
  
  // Clear all and start over
  const handleClearAll = useCallback(() => {
    setDepartureAirport(null);
    setArrivalAirport(null);
    setSelectedAircraft(null);
    setDepartureWeather(null);
    setArrivalWeather(null);
    setFlightPlan(null);
    setRouteGeoJSON(null);
    setAnimation({
      isPlaying: false,
      isPaused: false,
      progress: 0,
      currentLegIndex: 0,
      speed: 1,
    });
    setAircraftPosition(null);
  }, [
    setDepartureAirport,
    setArrivalAirport,
    setSelectedAircraft,
    setDepartureWeather,
    setArrivalWeather,
    setFlightPlan,
    setRouteGeoJSON,
    setAnimation,
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
                  placeholder="Enter ICAO (e.g., KJFK)"
                  icon={<span className="text-green-600">🛫</span>}
                />
                
                <AirportSelector
                  label="Arrival Airport"
                  selectedAirport={arrivalAirport}
                  onSelect={setArrivalAirport}
                  excludeIcao={departureAirport?.icao}
                  placeholder="Enter ICAO (e.g., KLAX)"
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
            
            {/* Weather panel */}
            <WeatherPanel
              departureWeather={departureWeather}
              arrivalWeather={arrivalWeather}
              departureAirport={departureAirport}
              arrivalAirport={arrivalAirport}
              isLoading={isLoadingWeather}
              onRefresh={handleFetchWeather}
            />
          </aside>
          
          {/* Center - Map */}
          <section className="col-span-12 lg:col-span-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <FlightMap
                routeGeoJSON={routeGeoJSON}
                layers={layers}
                aircraftPosition={aircraftPosition}
                aircraftHeading={aircraftHeading}
                animationState={animation}
                flightPlan={flightPlan}
                groundSpeed={groundSpeed}
                altitude={altitude}
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
            
            {/* Animation controls */}
            {flightPlan && (
              <div className="mt-4">
                <AnimationControls
                  animationState={animation}
                  flightPlan={flightPlan}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onReset={handleReset}
                  onSpeedChange={handleSpeedChange}
                  onProgressChange={handleProgressChange}
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
            Weather data from metar-taf.com • Maps from OpenStreetMap • 
            All distances in nautical miles, altitudes in feet, speeds in knots
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
