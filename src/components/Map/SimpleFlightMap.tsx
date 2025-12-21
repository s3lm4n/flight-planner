/**
 * Simple Flight Map Component for Runway-Based Planner
 * 
 * A lightweight map that displays:
 * - Route GeoJSON
 * - Aircraft position marker
 * - Departure and arrival markers
 * 
 * Does NOT require the full FlightPlan type.
 */

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate } from '@/types';

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
// AIRCRAFT ICON
// ============================================================================

function createAircraftIcon(heading: number) {
  return L.divIcon({
    className: 'aircraft-marker',
    html: `
      <div style="transform: rotate(${heading}deg); width: 32px; height: 32px;">
        <svg viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="1">
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

interface SimpleFlightMapProps {
  routeCoordinates: [number, number][];  // [lat, lon] pairs
  aircraftPosition: Coordinate | null;
  aircraftHeading: number;
  departurePosition: Coordinate | null;
  arrivalPosition: Coordinate | null;
  departureLabel?: string;
  arrivalLabel?: string;
  isPlaying?: boolean;
}

// ============================================================================
// MAP BOUNDS CONTROLLER
// ============================================================================

interface MapBoundsControllerProps {
  coordinates: [number, number][];
}

function MapBoundsController({ coordinates }: MapBoundsControllerProps) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates.length >= 2) {
      const bounds = L.latLngBounds(coordinates.map(([lat, lon]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);
  
  return null;
}

// ============================================================================
// AIRCRAFT MARKER
// ============================================================================

interface AircraftMarkerProps {
  position: Coordinate;
  heading: number;
}

function AircraftMarker({ position, heading }: AircraftMarkerProps) {
  return (
    <Marker
      position={[position.lat, position.lon]}
      icon={createAircraftIcon(heading)}
    />
  );
}

// ============================================================================
// MAIN MAP COMPONENT
// ============================================================================

export const SimpleFlightMap: React.FC<SimpleFlightMapProps> = ({
  routeCoordinates,
  aircraftPosition,
  aircraftHeading,
  departurePosition,
  arrivalPosition,
  departureLabel = 'DEP',
  arrivalLabel = 'ARR',
}) => {
  // Default center (mid-Atlantic)
  const defaultCenter: [number, number] = [45, -30];
  const defaultZoom = 3;
  
  // Calculate initial center based on departure/arrival
  const mapCenter = useMemo(() => {
    if (departurePosition && arrivalPosition) {
      return [
        (departurePosition.lat + arrivalPosition.lat) / 2,
        (departurePosition.lon + arrivalPosition.lon) / 2,
      ] as [number, number];
    }
    if (departurePosition) {
      return [departurePosition.lat, departurePosition.lon] as [number, number];
    }
    return defaultCenter;
  }, [departurePosition, arrivalPosition]);
  
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
              color: '#2563eb',
              weight: 3,
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Departure Marker */}
        {departurePosition && (
          <CircleMarker
            center={[departurePosition.lat, departurePosition.lon]}
            radius={8}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#22c55e',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{departureLabel}</strong>
              <br />
              {departurePosition.lat.toFixed(4)}°N, {departurePosition.lon.toFixed(4)}°E
            </Popup>
          </CircleMarker>
        )}
        
        {/* Arrival Marker - BLUE (not red!) */}
        {arrivalPosition && (
          <CircleMarker
            center={[arrivalPosition.lat, arrivalPosition.lon]}
            radius={8}
            pathOptions={{
              color: '#1d4ed8',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{arrivalLabel}</strong>
              <br />
              {arrivalPosition.lat.toFixed(4)}°N, {arrivalPosition.lon.toFixed(4)}°E
            </Popup>
          </CircleMarker>
        )}
        
        {/* Aircraft Marker */}
        {aircraftPosition && (
          <AircraftMarker 
            position={aircraftPosition}
            heading={aircraftHeading}
          />
        )}
        
        {/* Auto-fit bounds when route changes */}
        {routeCoordinates.length >= 2 && (
          <MapBoundsController coordinates={routeCoordinates} />
        )}
      </MapContainer>
    </div>
  );
};

export default SimpleFlightMap;
