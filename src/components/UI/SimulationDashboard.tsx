/**
 * Simulation Dashboard Component
 * 
 * Comprehensive real-time flight simulation display showing:
 * - Current position, altitude, speed
 * - Flight phase
 * - Wind information
 * - ETA and progress
 * - Leg information
 */

import React from 'react';
import { FlightPlan, Wind } from '@/types';
import { 
  SimulationState, 
  FlightPhase, 
  formatPhase, 
  getPhaseColor 
} from '@/hooks/useFlightSimulation';

interface SimulationDashboardProps {
  state: SimulationState;
  flightPlan: FlightPlan | null;
  wind: Wind | null;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onProgressChange: (progress: number) => void;
  speedMultiplier: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDistance(nm: number): string {
  if (nm >= 100) return `${Math.round(nm)} NM`;
  if (nm >= 10) return `${nm.toFixed(1)} NM`;
  return `${nm.toFixed(2)} NM`;
}

function formatAltitude(feet: number): string {
  if (feet >= 18000) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${Math.round(feet).toLocaleString()} ft`;
}

function formatHeading(degrees: number): string {
  return `${Math.round(degrees).toString().padStart(3, '0')}°`;
}

function formatCoordinate(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir} ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function getPhaseIcon(phase: FlightPhase): string {
  const icons: Record<FlightPhase, string> = {
    PREFLIGHT: '🛫',
    TAXI_OUT: '🚕',
    TAKEOFF: '🛫',
    CLIMB: '📈',
    CRUISE: '✈️',
    DESCENT: '📉',
    APPROACH: '🎯',
    FINAL: '🛬',
    LANDING: '🛬',
    TAXI_IN: '🚕',
    PARKED: '🅿️',
  };
  return icons[phase];
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SimulationDashboard: React.FC<SimulationDashboardProps> = ({
  state,
  flightPlan,
  wind,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onProgressChange,
  speedMultiplier,
}) => {
  if (!flightPlan) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="text-center text-gray-500 py-8">
          <span className="text-4xl mb-4 block">✈️</span>
          <p>Generate a flight plan to start simulation</p>
        </div>
      </div>
    );
  }
  
  const progressPercent = (state.totalProgress * 100).toFixed(1);
  const currentLeg = flightPlan.legs[state.currentLegIndex];
  const phaseColor = getPhaseColor(state.phase);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            {getPhaseIcon(state.phase)} Flight Simulation
          </h3>
          <div className="text-white text-sm font-mono">
            {flightPlan.departure.icao} → {flightPlan.arrival.icao}
          </div>
        </div>
      </div>
      
      {/* Phase indicator */}
      <div className={`px-4 py-2 bg-${phaseColor}-100 border-b border-${phaseColor}-200`}>
        <div className="flex items-center justify-between">
          <span className={`text-${phaseColor}-700 font-semibold`}>
            {formatPhase(state.phase)}
          </span>
          <span className={`text-${phaseColor}-600 text-sm`}>
            Leg {state.currentLegIndex + 1} of {flightPlan.legs.length}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{formatTime(state.elapsedSeconds)}</span>
            <span className="font-bold text-indigo-600">{progressPercent}%</span>
            <span>ETA: {formatTime(state.etaSeconds)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={state.totalProgress}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${progressPercent}%, #e5e7eb ${progressPercent}%, #e5e7eb 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatDistance(state.distanceFlown)}</span>
            <span>{formatDistance(state.distanceRemaining)} remaining</span>
          </div>
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={onReset}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Reset"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          <button
            onClick={state.isRunning && !state.isPaused ? onPause : onPlay}
            className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg"
          >
            {state.isRunning && !state.isPaused ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={() => onProgressChange(1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Skip to end"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
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
                  speedMultiplier === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        
        {/* Flight data grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Position */}
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Position</div>
            <div className="font-mono text-sm">
              {formatCoordinate(state.position.lat, state.position.lon)}
            </div>
          </div>
          
          {/* Altitude */}
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Altitude</div>
            <div className="font-bold text-lg text-indigo-600">
              {formatAltitude(state.altitude)}
            </div>
            {state.verticalSpeed !== 0 && (
              <div className={`text-xs ${state.verticalSpeed > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {state.verticalSpeed > 0 ? '↑' : '↓'} {Math.abs(Math.round(state.verticalSpeed))} fpm
              </div>
            )}
          </div>
          
          {/* Ground Speed */}
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Ground Speed</div>
            <div className="font-bold text-lg">
              {Math.round(state.groundSpeed)} kt
            </div>
            {state.trueAirspeed !== state.groundSpeed && (
              <div className="text-xs text-gray-500">
                TAS: {Math.round(state.trueAirspeed)} kt
              </div>
            )}
          </div>
          
          {/* Heading */}
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Heading</div>
            <div className="font-bold text-lg font-mono">
              {formatHeading(state.heading)}
            </div>
          </div>
        </div>
        
        {/* Wind info */}
        {wind && wind.speed > 0 && (
          <div className="bg-blue-50 rounded p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💨</span>
              <div>
                <div className="text-xs text-blue-600 mb-0.5">Wind</div>
                <div className="font-mono">
                  {wind.direction.toString().padStart(3, '0')}° / {wind.speed} kt
                  {wind.gust && ` G${wind.gust}`}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Current leg info */}
        {currentLeg && (
          <div className="bg-indigo-50 rounded p-3">
            <div className="text-xs text-indigo-600 mb-2 font-semibold">Current Leg</div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-indigo-700">
                  {currentLeg.from.id}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-mono font-bold text-indigo-700">
                  {currentLeg.to.id}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-indigo-200 text-indigo-700 rounded text-xs">
                {currentLeg.segmentType}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Dist</span>
                <div className="font-medium">{formatDistance(currentLeg.distance)}</div>
              </div>
              <div>
                <span className="text-gray-500">Course</span>
                <div className="font-medium font-mono">{formatHeading(currentLeg.course)}</div>
              </div>
              <div>
                <span className="text-gray-500">Alt</span>
                <div className="font-medium">{formatAltitude(currentLeg.altitude)}</div>
              </div>
              <div>
                <span className="text-gray-500">GS</span>
                <div className="font-medium">{Math.round(currentLeg.groundSpeed)} kt</div>
              </div>
            </div>
            
            {/* Leg progress bar */}
            <div className="mt-2">
              <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${state.legProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Leg overview */}
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Flight Progress</div>
          <div className="flex gap-0.5">
            {flightPlan.legs.map((leg, index) => {
              let bgColor = 'bg-gray-200';
              if (index < state.currentLegIndex) {
                bgColor = 'bg-indigo-600';
              } else if (index === state.currentLegIndex) {
                bgColor = 'bg-indigo-400';
              }
              
              return (
                <div
                  key={index}
                  className={`flex-1 h-2 rounded-sm ${bgColor} transition-colors`}
                  title={`${leg.from.id} → ${leg.to.id} (${leg.segmentType})`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationDashboard;
