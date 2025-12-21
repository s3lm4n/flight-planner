/**
 * Passive Flight Map Component
 * 
 * OWNERSHIP: This file owns ONLY map rendering.
 * 
 * THE MAP IS A PASSIVE VIEW. IT MUST NOT:
 * - Decide validity
 * - Show warnings via colors
 * - Determine flight correctness
 * - Modify zoom during animation ticks
 * 
 * THE MAP ONLY RENDERS:
 * - Frozen route (readonly)
 * - Current aircraft position (readonly)
 * - Current phase indicator
 * - Departure/arrival markers (fixed colors - NOT based on validation)
 * 
 * COLORS:
 * - Departure: GREEN (always)
 * - Arrival: BLUE (always, NEVER red)
 * - Route: Blue gradient
 * - Aircraft: Blue icon
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Polyline, Marker, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SimulationSnapshot, SimulationOutput, FlightPhase } from '@/types/simulation';

// Fix for default marker icons in Leaflet with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// ============================================================================
// COLOR CONSTANTS (NEVER change based on validation)
// ============================================================================

const COLORS = {
  departure: {
    stroke: '#16a34a',  // Green-600
    fill: '#22c55e',    // Green-500
  },
  arrival: {
    stroke: '#2563eb',  // Blue-600 (NEVER red!)
    fill: '#3b82f6',    // Blue-500 (NEVER red!)
  },
  route: {
    line: '#2563eb',    // Blue-600
    lineHover: '#1d4ed8', // Blue-700
  },
  aircraft: {
    fill: '#2563eb',    // Blue-600
    stroke: '#ffffff',
  },
};

// ============================================================================
// AIRCRAFT ICON
// ============================================================================

function createAircraftIcon(heading: number) {
  return L.divIcon({
    className: 'aircraft-marker',
    html: `
      <div style="transform: rotate(${heading}deg); width: 32px; height: 32px;">
        <svg viewBox="0 0 24 24" fill="${COLORS.aircraft.fill}" stroke="${COLORS.aircraft.stroke}" stroke-width="1">
          <path d="M12 2L8 8H4v2l8 3 8-3v-2h-4L12 2zM8 13v2l4 7 4-7v-2l-4 2-4-2z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// ============================================================================
// PROPS INTERFACE
// ============================================================================

interface PassiveFlightMapProps {
  /** Frozen simulation snapshot (readonly) */
  snapshot: SimulationSnapshot | null;
  
  /** Current simulation output (readonly) */
  output: SimulationOutput | null;
  
  /** Route coordinates for polyline [lat, lon][] */
  routeCoordinates: [number, number][];
}

// ============================================================================
// MAP CONTROLLER (Phase-Based Updates Only)
// ============================================================================

interface MapControllerProps {
  routeCoordinates: [number, number][];
  aircraftPosition: { lat: number; lon: number } | null;
  currentPhase: FlightPhase | null;
  isPlaying: boolean;
}

/**
 * Map view controller that ONLY updates on phase changes.
 * 
 * During animation ticks, the map view does NOT change.
 * Only the aircraft marker moves.
 */
function MapController({ routeCoordinates, aircraftPosition, currentPhase, isPlaying }: MapControllerProps) {
  const map = useMap();
  const previousPhaseRef = useRef<FlightPhase | null>(null);
  const hasSetInitialBoundsRef = useRef(false);
  
  // Set initial bounds ONCE when route is created
  useEffect(() => {
    if (routeCoordinates.length >= 2 && !hasSetInitialBoundsRef.current) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
      hasSetInitialBoundsRef.current = true;
    }
  }, [routeCoordinates.length > 0, map]);
  
  // Reset when route changes
  useEffect(() => {
    if (routeCoordinates.length < 2) {
      hasSetInitialBoundsRef.current = false;
    }
  }, [routeCoordinates]);
  
  // Update view on PHASE CHANGE only (not every tick)
  useEffect(() => {
    if (!isPlaying || !aircraftPosition || !currentPhase) return;
    if (currentPhase === previousPhaseRef.current) return;
    
    previousPhaseRef.current = currentPhase;
    
    // Phase-specific zoom levels
    const phaseZoom: Partial<Record<FlightPhase, number>> = {
      LINEUP: 15,
      TAKEOFF_ROLL: 14,
      V1: 14,
      ROTATE: 13,
      LIFTOFF: 12,
      INITIAL_CLIMB: 11,
      CLIMB: 9,
      CRUISE: 6,
      DESCENT: 8,
      APPROACH: 10,
      FINAL: 12,
      LANDING: 14,
      TAXI_IN: 15,
    };
    
    const zoom = phaseZoom[currentPhase] ?? 10;
    
    map.setView(
      [aircraftPosition.lat, aircraftPosition.lon],
      zoom,
      { animate: true, duration: 1 }
    );
  }, [currentPhase, isPlaying, map]); // Note: aircraftPosition NOT in deps - intentional
  
  return null;
}

// ============================================================================
// MAIN MAP COMPONENT
// ============================================================================

export const PassiveFlightMap: React.FC<PassiveFlightMapProps> = ({
  snapshot,
  output,
  routeCoordinates,
}) => {
  // Default center (mid-Atlantic)
  const defaultCenter: [number, number] = [45, -30];
  const defaultZoom = 3;
  
  // Calculate initial center from snapshot
  const mapCenter = useMemo(() => {
    if (snapshot) {
      return [
        (snapshot.departure.thresholdLat + snapshot.arrival.thresholdLat) / 2,
        (snapshot.departure.thresholdLon + snapshot.arrival.thresholdLon) / 2,
      ] as [number, number];
    }
    return defaultCenter;
  }, [snapshot]);
  
  // Aircraft position from output
  const aircraftPosition = output?.position ?? null;
  const aircraftHeading = output?.headingTrue ?? 0;
  const currentPhase = output?.phase ?? null;
  const isPlaying = output?.isPlaying ?? false;
  
  return (
    <div className="relative w-full h-[600px]">
      <MapContainer
        center={mapCenter}
        zoom={defaultZoom}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '600px' }}
      >
        {/* OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route Line */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: COLORS.route.line,
              weight: 3,
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Departure Marker - ALWAYS GREEN */}
        {snapshot && (
          <CircleMarker
            center={[snapshot.departure.thresholdLat, snapshot.departure.thresholdLon]}
            radius={8}
            pathOptions={{
              color: COLORS.departure.stroke,
              fillColor: COLORS.departure.fill,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <strong>🛫 {snapshot.departure.airportIcao}</strong>
              <br />
              RWY {snapshot.departure.runwayDesignator}
              <br />
              HDG {snapshot.departure.runwayHeadingTrue.toFixed(0)}°
            </Popup>
          </CircleMarker>
        )}
        
        {/* Arrival Marker - ALWAYS BLUE (NEVER RED) */}
        {snapshot && (
          <CircleMarker
            center={[snapshot.arrival.thresholdLat, snapshot.arrival.thresholdLon]}
            radius={8}
            pathOptions={{
              color: COLORS.arrival.stroke,
              fillColor: COLORS.arrival.fill,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <strong>🛬 {snapshot.arrival.airportIcao}</strong>
              <br />
              RWY {snapshot.arrival.runwayDesignator}
              <br />
              HDG {snapshot.arrival.runwayHeadingTrue.toFixed(0)}°
            </Popup>
          </CircleMarker>
        )}
        
        {/* Aircraft Marker */}
        {aircraftPosition && (
          <Marker
            position={[aircraftPosition.lat, aircraftPosition.lon]}
            icon={createAircraftIcon(aircraftHeading)}
          />
        )}
        
        {/* Map Controller (phase-based updates only) */}
        <MapController
          routeCoordinates={routeCoordinates}
          aircraftPosition={aircraftPosition}
          currentPhase={currentPhase}
          isPlaying={isPlaying}
        />
      </MapContainer>
      
      {/* Phase Indicator Overlay */}
      {output && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-mono z-[1000]">
          <div className="font-bold">{currentPhase}</div>
          <div className="text-xs opacity-80">
            {output.groundSpeedKts.toFixed(0)} kts | {output.altitudeFt.toFixed(0)} ft
          </div>
        </div>
      )}
    </div>
  );
};

export default PassiveFlightMap;
