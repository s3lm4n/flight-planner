/**
 * Aircraft Selector Component
 * 
 * Allows selecting an aircraft type from the database.
 */

import React, { useState, useMemo } from 'react';
import { Aircraft } from '@/types';
import { searchAircraft, getAllAircraft } from '@/data/aircraft';

interface AircraftSelectorProps {
  selectedAircraft: Aircraft | null;
  onSelect: (aircraft: Aircraft | null) => void;
}

export const AircraftSelector: React.FC<AircraftSelectorProps> = ({
  selectedAircraft,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Filtered aircraft
  const filteredAircraft = useMemo(() => {
    if (query.trim()) {
      return searchAircraft(query);
    }
    return getAllAircraft();
  }, [query]);
  
  // Handle selection
  const handleSelect = (aircraft: Aircraft) => {
    onSelect(aircraft);
    setIsExpanded(false);
    setQuery('');
  };
  
  // Clear selection
  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };
  
  return (
    <div className="aircraft-selector">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Aircraft Type
      </label>
      
      {/* Selected aircraft display */}
      {selectedAircraft ? (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-2xl">✈️</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-800">{selectedAircraft.icaoType}</span>
            </div>
            <div className="text-sm text-green-700 truncate">
              {selectedAircraft.name}
            </div>
          </div>
          <div className="text-right text-xs text-green-600">
            <div>Range: {selectedAircraft.performance.maxRange.toLocaleString()} nm</div>
            <div>Ceiling: FL{Math.round(selectedAircraft.performance.serviceCeiling / 100)}</div>
          </div>
          <button
            onClick={handleClear}
            className="p-1 text-green-400 hover:text-green-600 hover:bg-green-100 rounded"
            title="Clear selection"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                  placeholder="Search by ICAO type or name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              {/* Aircraft list */}
              <div className="max-h-64 overflow-auto">
                {filteredAircraft.length > 0 ? (
                  filteredAircraft.map((aircraft) => (
                    <button
                      key={aircraft.icaoType}
                      onClick={() => handleSelect(aircraft)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <span className="text-xl">✈️</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">
                            {aircraft.icaoType}
                          </span>
                          <span className="text-xs text-gray-500">
                            Cat {aircraft.category} / {aircraft.wakeCategory}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {aircraft.name}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{aircraft.engineCount}x {aircraft.engineType}</div>
                        <div>{aircraft.performance.maxRange.toLocaleString()} nm</div>
                      </div>
                    </button>
                  ))
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

export default AircraftSelector;
