/**
 * Animation Controls Component
 * 
 * Provides play/pause, speed control, and progress for aircraft animation.
 */

import React from 'react';
import { AnimationState, FlightPlan } from '@/types';
import { formatDistance } from '@/utils/aviation';

interface AnimationControlsProps {
  animationState: AnimationState;
  flightPlan: FlightPlan | null;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onProgressChange: (progress: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50];

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  animationState,
  flightPlan,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onProgressChange,
}) => {
  const { isPlaying, isPaused, progress, speed, currentLegIndex } = animationState;
  
  // Calculate current position info
  const progressPercent = (progress * 100).toFixed(1);
  const currentLeg = flightPlan?.legs[currentLegIndex];
  const totalDistance = flightPlan?.summary.distance || 0;
  const coveredDistance = totalDistance * progress;
  const remainingDistance = totalDistance - coveredDistance;
  
  // Format time
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins}m`;
  };
  
  const totalTime = flightPlan?.summary.totalTime || 0;
  const elapsedTime = totalTime * progress;
  const remainingTime = totalTime - elapsedTime;
  
  if (!flightPlan) {
    return null;
  }
  
  return (
    <div className="animation-controls bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          ✈️ Flight Simulation
        </h3>
        <div className="text-white text-sm">
          {flightPlan.departure.icao} → {flightPlan.arrival.icao}
        </div>
      </div>
      
      <div className="p-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{formatTime(elapsedTime)}</span>
            <span>{progressPercent}%</span>
            <span>-{formatTime(remainingTime)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatDistance(coveredDistance)}</span>
            <span>{formatDistance(remainingDistance)} remaining</span>
          </div>
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {/* Reset button */}
          <button
            onClick={onReset}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Reset to start"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          {/* Play/Pause button */}
          <button
            onClick={isPlaying && !isPaused ? onPause : onPlay}
            className="p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
            title={isPlaying && !isPaused ? 'Pause' : 'Play'}
          >
            {isPlaying && !isPaused ? (
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
            onClick={() => onProgressChange(1)}
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
        
        {/* Current leg info */}
        {currentLeg && (
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Current Leg</div>
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
              <span>FL{Math.round(currentLeg.altitude / 100)}</span>
              <span>GS {Math.round(currentLeg.groundSpeed)} kt</span>
            </div>
          </div>
        )}
        
        {/* Leg progress */}
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-2">
            Leg {currentLegIndex + 1} of {flightPlan.legs.length}
          </div>
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
                title={`${leg.from.id} → ${leg.to.id} (${leg.segmentType})`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
