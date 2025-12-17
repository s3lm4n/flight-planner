/**
 * Aircraft Marker Component
 * 
 * Displays an animated aircraft icon on the map that follows the route.
 * Shows current position, heading, and flight info.
 */

import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Coordinate, AnimationState, FlightPlan } from '@/types';
import { formatDistance, formatSpeed, formatAltitude } from '@/utils/aviation';

interface AircraftMarkerProps {
  position: Coordinate;
  heading: number;
  animationState: AnimationState;
  flightPlan: FlightPlan | null;
  groundSpeed?: number;
  altitude?: number;
}

// Create custom aircraft icon with rotation support - realistic airplane shape
const createAircraftIcon = (heading: number): L.DivIcon => {
  // Airplane SVG - pointing up (north) by default
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36" style="transform: rotate(${heading}deg); filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));">
      <!-- Fuselage -->
      <path d="M16 1 L18 8 L18 24 L20 28 L12 28 L14 24 L14 8 Z" 
            fill="#1e40af" stroke="#fff" stroke-width="0.5"/>
      <!-- Wings -->
      <path d="M16 10 L30 16 L30 18 L18 15 L18 15 L14 15 L2 18 L2 16 Z" 
            fill="#2563eb" stroke="#fff" stroke-width="0.5"/>
      <!-- Tail -->
      <path d="M16 22 L22 26 L22 27 L18 25 L14 25 L10 27 L10 26 Z" 
            fill="#3b82f6" stroke="#fff" stroke-width="0.5"/>
      <!-- Cockpit -->
      <ellipse cx="16" cy="5" rx="1.5" ry="2" fill="#60a5fa"/>
      <!-- Engine glow effect -->
      <circle cx="16" cy="28" r="1" fill="#fbbf24" opacity="0.8"/>
    </svg>
  `;
  
  return L.divIcon({
    className: 'aircraft-marker',
    html: svgIcon,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

export const AircraftMarker: React.FC<AircraftMarkerProps> = ({
  position,
  heading,
  animationState,
  flightPlan,
  groundSpeed = 0,
  altitude = 0,
}) => {
  // Create icon with current heading
  const icon = useMemo(() => createAircraftIcon(heading), [heading]);
  
  // Format progress percentage
  const progressPercent = (animationState.progress * 100).toFixed(1);
  
  // Calculate remaining distance and time
  const remainingInfo = useMemo(() => {
    if (!flightPlan) return null;
    
    const totalDistance = flightPlan.summary.distance;
    const remainingDistance = totalDistance * (1 - animationState.progress);
    const remainingTime = groundSpeed > 0 
      ? (remainingDistance / groundSpeed) * 60 
      : 0;
    
    return {
      distance: remainingDistance,
      time: remainingTime,
    };
  }, [flightPlan, animationState.progress, groundSpeed]);
  
  // Get current leg info
  const currentLegInfo = useMemo(() => {
    if (!flightPlan || animationState.currentLegIndex >= flightPlan.legs.length) {
      return null;
    }
    return flightPlan.legs[animationState.currentLegIndex];
  }, [flightPlan, animationState.currentLegIndex]);
  
  return (
    <Marker position={[position.lat, position.lon]} icon={icon}>
      <Popup>
        <div className="aircraft-popup min-w-[200px]">
          <div className="text-lg font-bold text-blue-800 border-b pb-2 mb-2">
            ✈️ {flightPlan?.aircraft?.name || 'Aircraft'}
          </div>
          
          {flightPlan && (
            <div className="text-sm text-gray-600 mb-2">
              {flightPlan.departure.icao} → {flightPlan.arrival.icao}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Position:</div>
            <div>
              {position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°
            </div>
            
            <div className="font-medium">Heading:</div>
            <div>{Math.round(heading)}°</div>
            
            <div className="font-medium">Ground Speed:</div>
            <div>{formatSpeed(groundSpeed)}</div>
            
            <div className="font-medium">Altitude:</div>
            <div>{formatAltitude(altitude)}</div>
            
            <div className="font-medium">Progress:</div>
            <div>{progressPercent}%</div>
          </div>
          
          {currentLegInfo && (
            <div className="mt-2 pt-2 border-t">
              <div className="font-medium text-sm">Current Leg:</div>
              <div className="text-sm text-gray-600">
                {currentLegInfo.from.id} → {currentLegInfo.to.id}
              </div>
              <div className="text-xs text-gray-500">
                {currentLegInfo.segmentType} • {formatDistance(currentLegInfo.distance)}
              </div>
            </div>
          )}
          
          {remainingInfo && (
            <div className="mt-2 pt-2 border-t text-sm">
              <div className="flex justify-between">
                <span>Remaining:</span>
                <span>{formatDistance(remainingInfo.distance)}</span>
              </div>
              <div className="flex justify-between">
                <span>ETE:</span>
                <span>{Math.round(remainingInfo.time)} min</span>
              </div>
            </div>
          )}
          
          <div className="mt-2 pt-2 border-t">
            <div className="text-xs text-gray-500">
              Speed: {animationState.speed}x
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${animationState.progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

export default AircraftMarker;
