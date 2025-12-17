/**
 * Airport Selector Component
 * 
 * Allows searching and selecting airports by ICAO code.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Airport } from '@/types';
import { searchAirports, getAllAirports } from '@/data/airports';

interface AirportSelectorProps {
  label: string;
  selectedAirport: Airport | null;
  onSelect: (airport: Airport | null) => void;
  excludeIcao?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}

export const AirportSelector: React.FC<AirportSelectorProps> = ({
  label,
  selectedAirport,
  onSelect,
  excludeIcao,
  placeholder = 'Search ICAO code...',
  icon,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search results
  const results = useMemo(() => {
    if (!query.trim()) {
      return getAllAirports()
        .filter(a => a.icao !== excludeIcao)
        .slice(0, 10);
    }
    return searchAirports(query).filter(a => a.icao !== excludeIcao);
  }, [query, excludeIcao]);
  
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle selection
  const handleSelect = useCallback((airport: Airport) => {
    onSelect(airport);
    setQuery('');
    setIsOpen(false);
  }, [onSelect]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, results, highlightedIndex, handleSelect]);
  
  // Clear selection
  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    inputRef.current?.focus();
  }, [onSelect]);
  
  return (
    <div className="airport-selector" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      
      <div className="relative">
        {/* Selected airport display */}
        {selectedAirport ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            {icon && <span className="text-blue-600">{icon}</span>}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-blue-800">{selectedAirport.icao}</div>
              <div className="text-sm text-blue-600 truncate">{selectedAirport.name}</div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value.toUpperCase());
                  setIsOpen(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {icon || (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </span>
            </div>
            
            {/* Dropdown */}
            {isOpen && results.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {results.map((airport, index) => (
                  <button
                    key={airport.icao}
                    onClick={() => handleSelect(airport)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                      index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono font-bold text-blue-600 w-12">
                      {airport.icao}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {airport.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {airport.city}, {airport.country} • Elev: {airport.elevation} ft
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {isOpen && query && results.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                No airports found for "{query}"
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AirportSelector;
