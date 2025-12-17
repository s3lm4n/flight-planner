/**
 * Main Flight Map Component
 * 
 * Renders the interactive map with all route layers and aircraft animation.
 */

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteLayer } from './RouteLayer';
import { AircraftMarker } from './AircraftMarker';
import { getLeafletBounds } from '@/utils/geojson';
import { Coordinate, RouteGeoJSON, RouteSegmentType, AnimationState, FlightPlan } from '@/types';

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
// PROPS INTERFACE
// ============================================================================

interface FlightMapProps {
  routeGeoJSON: RouteGeoJSON | null;
  layers: Record<RouteSegmentType, boolean>;
  aircraftPosition: Coordinate | null;
  aircraftHeading: number;
  animationState: AnimationState;
  flightPlan: FlightPlan | null;
  groundSpeed: number;
  altitude: number;
}

// ============================================================================
// MAP BOUNDS CONTROLLER
// ============================================================================

interface MapBoundsControllerProps {
  routeGeoJSON: RouteGeoJSON | null;
}

function MapBoundsController({ routeGeoJSON }: MapBoundsControllerProps) {
  const map = useMap();
  
  useEffect(() => {
    if (routeGeoJSON && routeGeoJSON.features.length > 0) {
      const bounds = getLeafletBounds(routeGeoJSON);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeGeoJSON, map]);
  
  return null;
}

// ============================================================================
// MAIN MAP COMPONENT
// ============================================================================

export const FlightMap: React.FC<FlightMapProps> = ({
  routeGeoJSON,
  layers,
  aircraftPosition,
  aircraftHeading,
  animationState,
  flightPlan,
  groundSpeed,
  altitude,
}) => {
  // Default center (mid-Atlantic) and zoom
  const defaultCenter: [number, number] = [45, -30];
  const defaultZoom = 3;
  
  // Calculate initial center based on flight plan airports
  const mapCenter = useMemo(() => {
    if (flightPlan) {
      return [
        (flightPlan.departure.position.lat + flightPlan.arrival.position.lat) / 2,
        (flightPlan.departure.position.lon + flightPlan.arrival.position.lon) / 2,
      ] as [number, number];
    }
    return defaultCenter;
  }, [flightPlan]);
  
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route Layers */}
        {routeGeoJSON && (
          <>
            {layers.TAXI_OUT && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="TAXI_OUT" 
              />
            )}
            {layers.SID && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="SID" 
              />
            )}
            {layers.ENROUTE && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="ENROUTE" 
              />
            )}
            {layers.STAR && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="STAR" 
              />
            )}
            {layers.APPROACH && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="APPROACH" 
              />
            )}
            {layers.TAXI_IN && (
              <RouteLayer 
                routeGeoJSON={routeGeoJSON} 
                segmentType="TAXI_IN" 
              />
            )}
          </>
        )}
        
        {/* Waypoint Markers */}
        {routeGeoJSON && (
          <RouteLayer 
            routeGeoJSON={routeGeoJSON} 
            segmentType={null}
            showWaypoints={true}
          />
        )}
        
        {/* Aircraft Marker */}
        {aircraftPosition && flightPlan && (
          <AircraftMarker 
            position={aircraftPosition}
            heading={aircraftHeading}
            animationState={animationState}
            flightPlan={flightPlan}
            groundSpeed={groundSpeed}
            altitude={altitude}
          />
        )}
        
        {/* Auto-fit bounds when route changes */}
        <MapBoundsController routeGeoJSON={routeGeoJSON} />
      </MapContainer>
    </div>
  );
};

export default FlightMap;
