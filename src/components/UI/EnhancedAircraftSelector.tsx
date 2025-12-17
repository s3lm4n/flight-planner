/**
 * Enhanced Aircraft Selector Component
 * 
 * Aircraft selector with validation status display.
 * Shows warnings/errors when aircraft is incompatible with selected airports.
 */

import React, { useState, useMemo } from 'react';
import { EnhancedAircraft, ValidationIssue } from '@/types/aircraft';
import { getAllEnhancedAircraft, searchEnhancedAircraft } from '@/data/aircraftDatabase';

interface EnhancedAircraftSelectorProps {
  selectedAircraft: EnhancedAircraft | null;
  onSelect: (aircraft: EnhancedAircraft | null) => void;
  validationIssues?: ValidationIssue[];
  minRunwayAvailable?: number;  // Highlight aircraft that can use this runway
}

export const EnhancedAircraftSelector: React.FC<EnhancedAircraftSelectorProps> = ({
  selectedAircraft,
  onSelect,
  validationIssues = [],
  minRunwayAvailable,
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get validation status
  const hasBlockingIssues = validationIssues.some(i => i.severity === 'BLOCKING');
  const hasErrors = validationIssues.some(i => i.severity === 'ERROR');
  const hasWarnings = validationIssues.some(i => i.severity === 'WARNING');
  
  const validationStatus: 'valid' | 'warning' | 'error' | 'blocked' = 
    hasBlockingIssues ? 'blocked' :
    hasErrors ? 'error' :
    hasWarnings ? 'warning' : 'valid';
  
  // Get all aircraft with filtering
  const allAircraft = useMemo(() => getAllEnhancedAircraft(), []);
  
  const filteredAircraft = useMemo(() => {
    if (query.trim()) {
      return searchEnhancedAircraft(query);
    }
    return allAircraft;
  }, [query, allAircraft]);
  
  // Check if aircraft is suitable for runway
  const isAircraftSuitable = (aircraft: EnhancedAircraft): boolean => {
    if (!minRunwayAvailable) return true;
    return aircraft.runwayRequirements.minTakeoffRunway <= minRunwayAvailable &&
           aircraft.runwayRequirements.minLandingRunway <= minRunwayAvailable;
  };
  
  // Handle selection
  const handleSelect = (aircraft: EnhancedAircraft) => {
    onSelect(aircraft);
    setIsExpanded(false);
    setQuery('');
  };
  
  // Clear selection
  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };
  
  // Get status colors
  const getStatusColors = () => {
    switch (validationStatus) {
      case 'blocked':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-800',
          subtext: 'text-red-600',
          icon: 'text-red-500',
        };
      case 'error':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-300',
          text: 'text-orange-800',
          subtext: 'text-orange-600',
          icon: 'text-orange-500',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-300',
          text: 'text-yellow-800',
          subtext: 'text-yellow-600',
          icon: 'text-yellow-500',
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          subtext: 'text-green-600',
          icon: 'text-green-500',
        };
    }
  };
  
  // Get wake category label
  const getWakeCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      'L': 'Light',
      'M': 'Medium',
      'H': 'Heavy',
      'J': 'Super',
    };
    return labels[cat] || cat;
  };
  
  const colors = getStatusColors();
  
  return (
    <div className="enhanced-aircraft-selector">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Aircraft Type
      </label>
      
      {/* Selected aircraft display */}
      {selectedAircraft ? (
        <div className={`rounded-lg border ${colors.bg} ${colors.border}`}>
          <div className="flex items-center gap-3 p-3">
            <span className="text-2xl">✈️</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${colors.text}`}>{selectedAircraft.icaoCode}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  selectedAircraft.wakeTurbulenceCategory === 'H' ? 'bg-purple-100 text-purple-700' :
                  selectedAircraft.wakeTurbulenceCategory === 'J' ? 'bg-red-100 text-red-700' :
                  selectedAircraft.wakeTurbulenceCategory === 'M' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {getWakeCategoryLabel(selectedAircraft.wakeTurbulenceCategory)}
                </span>
              </div>
              <div className={`text-sm truncate ${colors.subtext}`}>
                {selectedAircraft.name}
              </div>
              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 mt-1">
                <span>Range: {selectedAircraft.fuel.maxRange.toLocaleString()} nm</span>
                <span>•</span>
                <span>T/O: {selectedAircraft.runwayRequirements.minTakeoffRunway}m</span>
                <span>•</span>
                <span>LDG: {selectedAircraft.runwayRequirements.minLandingRunway}m</span>
              </div>
            </div>
            <button
              onClick={handleClear}
              className={`p-1 ${colors.icon} hover:opacity-70 rounded`}
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Validation issues */}
          {validationIssues.length > 0 && (
            <div className={`px-3 pb-3 space-y-1 border-t ${colors.border}`}>
              <div className="pt-2 text-xs font-medium text-gray-600">
                {hasBlockingIssues ? '⛔ Flight Blocked:' : 
                 hasErrors ? '⚠️ Issues Found:' : 
                 '⚡ Warnings:'}
              </div>
              {validationIssues.slice(0, 3).map((issue, idx) => (
                <div 
                  key={idx} 
                  className={`text-xs ${
                    issue.severity === 'BLOCKING' ? 'text-red-700' :
                    issue.severity === 'ERROR' ? 'text-orange-700' :
                    'text-yellow-700'
                  }`}
                >
                  • {issue.title}: {issue.message}
                </div>
              ))}
              {validationIssues.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{validationIssues.length - 3} more issues
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Toggle button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 transition-colors"
          >
            <span className="text-gray-500">Select aircraft type...</span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Expanded selector */}
          {isExpanded && (
            <div className="mt-2 border border-gray-200 rounded-lg shadow-lg bg-white overflow-hidden">
              {/* Search input */}
              <div className="p-3 border-b">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.toUpperCase())}
                  placeholder="Search by ICAO type, name, or manufacturer..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              {/* Runway requirement hint */}
              {minRunwayAvailable && (
                <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-600">
                  💡 Available runway: {minRunwayAvailable}m — unsuitable aircraft shown in gray
                </div>
              )}
              
              {/* Aircraft list */}
              <div className="max-h-80 overflow-auto">
                {filteredAircraft.length > 0 ? (
                  filteredAircraft.map((aircraft) => {
                    const suitable = isAircraftSuitable(aircraft);
                    
                    return (
                      <button
                        key={aircraft.icaoCode}
                        onClick={() => handleSelect(aircraft)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-100 last:border-b-0 ${
                          suitable 
                            ? 'hover:bg-blue-50' 
                            : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        <span className="text-xl">✈️</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${suitable ? 'text-blue-600' : 'text-gray-400'}`}>
                              {aircraft.icaoCode}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              aircraft.wakeTurbulenceCategory === 'H' ? 'bg-purple-100 text-purple-700' :
                              aircraft.wakeTurbulenceCategory === 'J' ? 'bg-red-100 text-red-700' :
                              aircraft.wakeTurbulenceCategory === 'M' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {getWakeCategoryLabel(aircraft.wakeTurbulenceCategory)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {aircraft.engineCount}x {aircraft.engineType}
                            </span>
                          </div>
                          <div className={`text-sm truncate ${suitable ? 'text-gray-700' : 'text-gray-400'}`}>
                            {aircraft.name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <span>T/O: {aircraft.runwayRequirements.minTakeoffRunway}m</span>
                            <span>LDG: {aircraft.runwayRequirements.minLandingRunway}m</span>
                            <span>Range: {aircraft.fuel.maxRange.toLocaleString()} nm</span>
                          </div>
                        </div>
                        {!suitable && (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">
                            Runway too short
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No aircraft found
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EnhancedAircraftSelector;
