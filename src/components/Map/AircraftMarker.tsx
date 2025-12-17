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

// Create custom aircraft icon with rotation support
const createAircraftIcon = (heading: number): L.DivIcon => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" style="transform: rotate(${heading}deg);">
      <path d="M12 2L4 14h3l1 8h8l1-8h3L12 2z" 
            fill="#1a365d" 
            stroke="#fff" 
            stroke-width="1"
            stroke-linejoin="round"/>
    </svg>
  `;
  
  return L.divIcon({
    className: 'aircraft-marker',
    html: svgIcon,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
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
