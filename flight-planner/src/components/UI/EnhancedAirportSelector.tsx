/**
 * Enhanced Airport Selector Component
 * 
 * Virtualized airport selector that can handle thousands of European airports.
 * Supports search by ICAO, IATA, name, city, or country.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { EnhancedAirport } from '@/types/airport';

interface EnhancedAirportSelectorProps {
  label: string;
  airports: EnhancedAirport[];
  selectedAirport: EnhancedAirport | null;
  onSelect: (airport: EnhancedAirport | null) => void;
  excludeIcao?: string;
  isLoading?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  hasValidationError?: boolean;
}

const VISIBLE_ITEMS = 8;
const ITEM_HEIGHT = 72;

export const EnhancedAirportSelector: React.FC<EnhancedAirportSelectorProps> = ({
  label,
  airports,
  selectedAirport,
  onSelect,
  excludeIcao,
  isLoading = false,
  placeholder = 'Search ICAO, IATA, name, city...',
  icon,
  hasValidationError = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Filter and search airports
  const filteredAirports = useMemo(() => {
    let results = airports.filter(a => a.icao !== excludeIcao);
    
    if (query.trim()) {
      const q = query.toUpperCase();
      results = results.filter(airport =>
        airport.icao.includes(q) ||
        (airport.iata && airport.iata.includes(q)) ||
        airport.name.toUpperCase().includes(q) ||
        airport.city.toUpperCase().includes(q) ||
        airport.country.toUpperCase().includes(q)
      );
      
      // Sort by relevance (exact ICAO match first, then IATA, then name)
      results.sort((a, b) => {
        if (a.icao === q) return -1;
        if (b.icao === q) return 1;
        if (a.iata === q) return -1;
        if (b.iata === q) return 1;
        if (a.icao.startsWith(q)) return -1;
        if (b.icao.startsWith(q)) return 1;
        return 0;
      });
    }
    
    return results;
  }, [airports, query, excludeIcao]);
  
  // Virtualization calculations
  const totalHeight = filteredAirports.length * ITEM_HEIGHT;
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = Math.min(
    startIndex + VISIBLE_ITEMS + 2,
    filteredAirports.length
  );
  const visibleAirports = filteredAirports.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;
  
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
  const handleSelect = useCallback((airport: EnhancedAirport) => {
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
        setHighlightedIndex(i => Math.min(i + 1, filteredAirports.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredAirports[highlightedIndex]) {
          handleSelect(filteredAirports[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredAirports, highlightedIndex, handleSelect]);
  
  // Scroll to highlighted item
  useEffect(() => {
    if (listRef.current && isOpen) {
      const itemTop = highlightedIndex * ITEM_HEIGHT;
      const itemBottom = itemTop + ITEM_HEIGHT;
      const visibleTop = scrollTop;
      const visibleBottom = scrollTop + VISIBLE_ITEMS * ITEM_HEIGHT;
      
      if (itemTop < visibleTop) {
        listRef.current.scrollTop = itemTop;
      } else if (itemBottom > visibleBottom) {
        listRef.current.scrollTop = itemBottom - VISIBLE_ITEMS * ITEM_HEIGHT;
      }
    }
  }, [highlightedIndex, isOpen, scrollTop]);
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  // Clear selection
  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    inputRef.current?.focus();
  }, [onSelect]);
  
  // Get airport type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'LARGE_AIRPORT':
        return <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Large</span>;
      case 'MEDIUM_AIRPORT':
        return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">Medium</span>;
      case 'SMALL_AIRPORT':
        return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">Small</span>;
      default:
        return null;
    }
  };
  
  // Get longest runway
  const getLongestRunway = (airport: EnhancedAirport) => {
    if (!airport.runways || airport.runways.length === 0) return null;
    const longest = airport.runways.reduce((max, r) => 
      r.lengthMeters > max.lengthMeters ? r : max
    );
    return longest;
  };
  
  return (
    <div className="enhanced-airport-selector" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {isLoading && (
          <span className="ml-2 text-xs text-gray-400">Loading airports...</span>
        )}
      </label>
      
      <div className="relative">
        {/* Selected airport display */}
        {selectedAirport ? (
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            hasValidationError 
              ? 'bg-red-50 border-red-300' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            {icon && <span className={hasValidationError ? 'text-red-600' : 'text-blue-600'}>{icon}</span>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${hasValidationError ? 'text-red-800' : 'text-blue-800'}`}>
                  {selectedAirport.icao}
                </span>
                {selectedAirport.iata && (
                  <span className="text-xs text-gray-500">({selectedAirport.iata})</span>
                )}
                {getTypeBadge(selectedAirport.type)}
              </div>
              <div className={`text-sm truncate ${hasValidationError ? 'text-red-600' : 'text-blue-600'}`}>
                {selectedAirport.name}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{selectedAirport.city}, {selectedAirport.country}</span>
                <span>•</span>
                <span>Elev: {selectedAirport.elevation} ft</span>
                {(() => {
                  const rwy = getLongestRunway(selectedAirport);
                  return rwy ? (
                    <>
                      <span>•</span>
                      <span>RWY: {rwy.lengthMeters}m</span>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
            <button
              onClick={handleClear}
              className={`p-1 rounded hover:bg-opacity-20 ${
                hasValidationError 
                  ? 'text-red-400 hover:text-red-600 hover:bg-red-100' 
                  : 'text-blue-400 hover:text-blue-600 hover:bg-blue-100'
              }`}
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
                  setScrollTop(0);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {icon || (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </span>
              {query && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {filteredAirports.length} results
                </span>
              )}
            </div>
            
            {/* Dropdown */}
            {isOpen && !isLoading && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {filteredAirports.length > 0 ? (
                  <div
                    ref={listRef}
                    className="overflow-auto"
                    style={{ maxHeight: VISIBLE_ITEMS * ITEM_HEIGHT }}
                    onScroll={handleScroll}
                  >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                      <div style={{ transform: `translateY(${offsetY}px)` }}>
                        {visibleAirports.map((airport, idx) => {
                          const actualIndex = startIndex + idx;
                          const isHighlighted = actualIndex === highlightedIndex;
                          const longestRwy = getLongestRunway(airport);
                          
                          return (
                            <button
                              key={airport.icao}
                              onClick={() => handleSelect(airport)}
                              onMouseEnter={() => setHighlightedIndex(actualIndex)}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-100 ${
                                isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                              style={{ height: ITEM_HEIGHT }}
                            >
                              <div className="flex-shrink-0 pt-1">
                                <span className="font-mono font-bold text-blue-600 w-12 block">
                                  {airport.icao}
                                </span>
                                {airport.iata && (
                                  <span className="text-xs text-gray-400">{airport.iata}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {airport.name}
                                  </span>
                                  {getTypeBadge(airport.type)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {airport.city}, {airport.country}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                  <span>Elev: {airport.elevation} ft</span>
                                  {longestRwy && (
                                    <>
                                      <span>•</span>
                                      <span>RWY {longestRwy.designator}: {longestRwy.lengthMeters}m × {longestRwy.widthMeters}m</span>
                                      <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">
                                        {longestRwy.surface}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {query ? `No airports found for "${query}"` : 'Start typing to search airports'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EnhancedAirportSelector;
