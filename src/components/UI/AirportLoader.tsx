/**
 * Airport Data Loader Component
 * 
 * UI component for loading airport data from:
 * - CSV file upload
 * - Predefined URLs
 * - API fetch
 */

import React, { useState, useCallback } from 'react';
import { useAirportStore } from '@/store/airportStore';

interface AirportLoaderProps {
  onLoadComplete?: () => void;
}

export const AirportLoader: React.FC<AirportLoaderProps> = ({ onLoadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadSource, setLoadSource] = useState<'csv' | 'api' | null>(null);
  
  const {
    loadFromFile,
    loadFromApi,
    isLoading,
    isLoaded,
    loadError,
    totalCount,
    lastUpdated,
    source,
  } = useAirportStore();
  
  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please drop a CSV file');
      return;
    }
    
    setLoadSource('csv');
    await loadFromFile(file);
    onLoadComplete?.();
  }, [loadFromFile, onLoadComplete]);
  
  // Handle file input
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoadSource('csv');
    await loadFromFile(file);
    onLoadComplete?.();
  }, [loadFromFile, onLoadComplete]);
  
  // Handle API load
  const handleApiLoad = useCallback(async () => {
    setLoadSource('api');
    await loadFromApi();
    onLoadComplete?.();
  }, [loadFromApi, onLoadComplete]);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          🗺️ Airport Data
        </h3>
      </div>
      
      <div className="p-4">
        {/* Status display */}
        {isLoaded && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-xl">✅</span>
              <div>
                <div className="font-semibold">
                  {totalCount.toLocaleString()} airports loaded
                </div>
                <div className="text-sm text-green-600">
                  Source: {source === 'csv' ? 'CSV File' : 'API'} 
                  {lastUpdated && ` • ${lastUpdated.toLocaleString()}`}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error display */}
        {loadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-xl">❌</span>
              <div>
                <div className="font-semibold">Load failed</div>
                <div className="text-sm">{loadError}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {isLoading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <div>
                <div className="font-semibold">Loading airports...</div>
                <div className="text-sm text-blue-600">
                  {loadSource === 'csv' ? 'Parsing CSV file...' : 'Fetching from API...'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Load options */}
        {!isLoaded && !isLoading && (
          <>
            {/* CSV Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📄</div>
                <div className="font-medium text-gray-700 mb-1">
                  Drop airports.csv here
                </div>
                <div className="text-sm text-gray-500 mb-3">
                  or click to browse
                </div>
                <div className="text-xs text-gray-400">
                  Supports OurAirports CSV format
                </div>
              </label>
            </div>
            
            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-3 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            
            {/* API Load button */}
            <button
              onClick={handleApiLoad}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>🌐</span>
              Load from Aviation API
            </button>
            
            <p className="mt-2 text-xs text-gray-500 text-center">
              Fetches European + Turkey airports from aviation API
            </p>
          </>
        )}
        
        {/* Reload option when already loaded */}
        {isLoaded && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500 mb-2">Reload data:</div>
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="block w-full px-3 py-2 text-center text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer transition-colors">
                  📄 New CSV
                </span>
              </label>
              <button
                onClick={handleApiLoad}
                className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                🌐 Refresh API
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AirportLoader;
