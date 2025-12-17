/**
 * Flight Plan Panel Component
 * 
 * Displays detailed flight plan information including legs, times, and fuel.
 */

import React, { useState } from 'react';
import { FlightPlan, FlightLeg, RouteSegmentType } from '@/types';
import { formatDistance, formatAltitude } from '@/utils/aviation';
import { getSegmentColor } from '@/utils/geojson';

interface FlightPlanPanelProps {
  flightPlan: FlightPlan | null;
  isGenerating: boolean;
  onGeneratePlan: () => void;
  onHighlightLeg?: (legIndex: number | null) => void;
}

interface LegRowProps {
  leg: FlightLeg;
  index: number;
  onHover: (index: number | null) => void;
}

// Format time in hours:minutes
const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Format fuel
const formatFuel = (kg: number): string => {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}t`;
  }
  return `${Math.round(kg)} kg`;
};

// Leg Row Component
const LegRow: React.FC<LegRowProps> = ({ leg, index, onHover }) => {
  const segmentColor = getSegmentColor(leg.segmentType);
  
  return (
    <tr
      className="hover:bg-gray-50 transition-colors cursor-pointer"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: segmentColor }}
          />
          <span className="font-mono text-xs">{leg.from.id}</span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{leg.to.id}</td>
      <td className="px-3 py-2 text-right text-xs">
        {formatDistance(leg.distance)}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {Math.round(leg.course)}°
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {formatAltitude(leg.altitude)}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {Math.round(leg.groundSpeed)} kt
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {formatTime(leg.ete)}
      </td>
      <td className="px-3 py-2">
        <span
          className="px-2 py-0.5 text-xs rounded"
          style={{
            backgroundColor: `${segmentColor}20`,
            color: segmentColor,
          }}
        >
          {leg.segmentType}
        </span>
      </td>
    </tr>
  );
};

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  flightPlan,
  isGenerating,
  onGeneratePlan,
  onHighlightLeg,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('route');
  
  const handleLegHover = (index: number | null) => {
    onHighlightLeg?.(index);
  };
  
  // Group legs by segment type
  const legsBySegment = flightPlan?.legs.reduce((acc, leg) => {
    if (!acc[leg.segmentType]) {
      acc[leg.segmentType] = [];
    }
    acc[leg.segmentType].push(leg);
    return acc;
  }, {} as Record<RouteSegmentType, FlightLeg[]>);
  
  return (
    <div className="flight-plan-panel bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-600 to-green-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          📋 Flight Plan
        </h3>
        {!flightPlan && (
          <button
            onClick={onGeneratePlan}
            disabled={isGenerating}
            className="px-3 py-1 bg-white text-green-700 rounded text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Plan'}
          </button>
        )}
      </div>
      
      {/* Loading state */}
      {isGenerating && (
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <div className="text-gray-500">Generating flight plan...</div>
        </div>
      )}
      
      {/* No flight plan */}
      {!isGenerating && !flightPlan && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <div className="mb-2">No flight plan generated</div>
          <div className="text-sm">Select departure, arrival, and aircraft first</div>
        </div>
      )}
      
      {/* Flight plan display */}
      {flightPlan && (
        <div className="max-h-[600px] overflow-auto">
          {/* Summary */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold text-gray-800">
                {flightPlan.departure.icao} → {flightPlan.arrival.icao}
              </div>
              <div className="text-sm text-gray-500">
                {flightPlan.aircraft?.icaoType || 'N/A'}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-xs text-gray-500">Distance</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatDistance(flightPlan.summary.distance)}
                </div>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-xs text-gray-500">Flight Time</div>
                <div className="text-lg font-bold text-green-600">
                  {formatTime(flightPlan.summary.totalTime)}
                </div>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-xs text-gray-500">Cruise Alt</div>
                <div className="text-lg font-bold text-purple-600">
                  FL{Math.round(flightPlan.summary.cruiseAltitude / 100)}
                </div>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <div className="text-xs text-gray-500">Est. Fuel</div>
                <div className="text-lg font-bold text-orange-600">
                  {formatFuel(flightPlan.summary.estimatedFuel)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Segment summary */}
          {legsBySegment && (
            <div className="p-4 border-b">
              <button
                onClick={() => setExpandedSection(expandedSection === 'segments' ? null : 'segments')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="font-semibold text-gray-700">Phase Breakdown</span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'segments' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedSection === 'segments' && (
                <div className="mt-3 space-y-2">
                  {Object.entries(legsBySegment).map(([segment, legs]) => {
                    const totalDist = legs.reduce((sum, l) => sum + l.distance, 0);
                    const totalTime = legs.reduce((sum, l) => sum + l.ete, 0);
                    const color = getSegmentColor(segment as RouteSegmentType);
                    
                    return (
                      <div
                        key={segment}
                        className="flex items-center justify-between p-2 rounded"
                        style={{ backgroundColor: `${color}10` }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-sm" style={{ color }}>
                            {segment}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {legs.length} legs • {formatDistance(totalDist)} • {formatTime(totalTime)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* Route table */}
          <div className="p-4">
            <button
              onClick={() => setExpandedSection(expandedSection === 'route' ? null : 'route')}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <span className="font-semibold text-gray-700">
                Route ({flightPlan.legs.length} legs)
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'route' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'route' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">FROM</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">TO</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">DIST</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">CRS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">ALT</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">GS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">ETE</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">TYPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flightPlan.legs.map((leg, index) => (
                      <LegRow
                        key={`${leg.from.id}-${leg.to.id}-${index}`}
                        leg={leg}
                        index={index}
                        onHover={handleLegHover}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Waypoint string */}
          <div className="p-4 border-t bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Route String</div>
            <div className="text-xs font-mono bg-white p-2 rounded border break-all">
              {flightPlan.legs.map(l => l.from.id).join(' ')} {flightPlan.legs[flightPlan.legs.length - 1]?.to.id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightPlanPanel;
