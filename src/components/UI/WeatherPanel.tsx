/**
 * Weather Panel Component
 * 
 * Displays METAR and TAF weather information for departure and arrival airports.
 */

import React, { useState } from 'react';
import { Metar, Taf, Airport, AirportWeather } from '@/types';

interface WeatherPanelProps {
  departureWeather: AirportWeather | null;
  arrivalWeather: AirportWeather | null;
  departureAirport: Airport | null;
  arrivalAirport: Airport | null;
  isLoading: boolean;
  onRefresh: () => void;
}

interface MetarDisplayProps {
  metar: Metar;
  label: string;
}

interface TafDisplayProps {
  taf: Taf;
}

// Get flight category color
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'VFR':
      return 'text-green-600 bg-green-100';
    case 'MVFR':
      return 'text-blue-600 bg-blue-100';
    case 'IFR':
      return 'text-red-600 bg-red-100';
    case 'LIFR':
      return 'text-purple-600 bg-purple-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

// Get wind direction arrow
const getWindArrow = (direction: number): string => {
  const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
  const index = Math.round(direction / 45) % 8;
  return arrows[index];
};

// METAR Display Component
const MetarDisplay: React.FC<MetarDisplayProps> = ({ metar, label }) => {
  const categoryColor = getCategoryColor(metar.flightCategory);
  
  return (
    <div className="metar-display">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-800">{label} METAR</h4>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColor}`}>
          {metar.flightCategory}
        </span>
      </div>
      
      {/* Raw METAR */}
      <div className="text-xs font-mono bg-gray-100 p-2 rounded mb-3 break-all">
        {metar.raw}
      </div>
      
      {/* Decoded values */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Wind */}
        <div className="flex items-center gap-2">
          <span className="text-lg">{metar.wind.variable ? '🌀' : getWindArrow(metar.wind.direction)}</span>
          <div>
            <div className="text-xs text-gray-500">Wind</div>
            <div className="font-medium">
              {metar.wind.variable ? 'VRB' : `${metar.wind.direction.toString().padStart(3, '0')}°`}
              {' '}{metar.wind.speed} kt
              {metar.wind.gust && ` G${metar.wind.gust}`}
            </div>
          </div>
        </div>
        
        {/* Visibility */}
        <div className="flex items-center gap-2">
          <span className="text-lg">👁️</span>
          <div>
            <div className="text-xs text-gray-500">Visibility</div>
            <div className="font-medium">
              {metar.visibility.value >= 10 ? '10+ SM' : `${metar.visibility.value} SM`}
            </div>
          </div>
        </div>
        
        {/* Temperature */}
        <div className="flex items-center gap-2">
          <span className="text-lg">🌡️</span>
          <div>
            <div className="text-xs text-gray-500">Temperature</div>
            <div className="font-medium">
              {metar.temperature}°C / DP {metar.dewpoint}°C
            </div>
          </div>
        </div>
        
        {/* Pressure */}
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <div className="text-xs text-gray-500">Altimeter</div>
            <div className="font-medium">
              {metar.altimeter < 1100 
                ? `${metar.altimeter.toFixed(2)}" Hg`
                : `${metar.altimeter} hPa`
              }
            </div>
          </div>
        </div>
      </div>
      
      {/* Clouds */}
      {metar.clouds.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Clouds</div>
          <div className="flex flex-wrap gap-2">
            {metar.clouds.map((cloud, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 rounded text-xs font-mono"
              >
                {cloud.coverage} {(cloud.altitude * 100).toLocaleString()} ft
                {cloud.type && ` ${cloud.type}`}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Weather phenomena */}
      {metar.weather.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Weather</div>
          <div className="flex flex-wrap gap-2">
            {metar.weather.map((wx, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
              >
                {wx}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Observation time */}
      <div className="mt-3 text-xs text-gray-400">
        Observed: {metar.observationTime.toLocaleString()}
      </div>
    </div>
  );
};

// TAF Display Component
const TafDisplay: React.FC<TafDisplayProps> = ({ taf }) => {
  return (
    <div className="taf-display mt-4">
      <h4 className="font-semibold text-gray-800 mb-2">TAF Forecast</h4>
      
      {/* Raw TAF */}
      <div className="text-xs font-mono bg-gray-100 p-2 rounded mb-3 break-all">
        {taf.raw}
      </div>
      
      {/* Valid period */}
      <div className="text-xs text-gray-500 mb-2">
        Valid: {taf.validFrom.toLocaleString()} - {taf.validTo.toLocaleString()}
      </div>
      
      {/* Forecast periods */}
      <div className="space-y-2">
        {taf.periods.slice(0, 4).map((period, index) => (
          <div key={index} className="text-sm p-2 bg-gray-50 rounded">
            <div className="font-medium text-xs text-gray-500 mb-1">
              {period.type} - {period.from.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {period.to && ` to ${period.to.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </div>
            <div className="flex gap-4 text-xs">
              {period.wind && (
                <span>
                  Wind: {period.wind.direction}°/{period.wind.speed}kt
                  {period.wind.gust && ` G${period.wind.gust}`}
                </span>
              )}
              {period.visibility && (
                <span>Vis: {period.visibility.value} SM</span>
              )}
              {period.weather && period.weather.length > 0 && (
                <span>Wx: {period.weather.join(', ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WeatherPanel: React.FC<WeatherPanelProps> = ({
  departureWeather,
  arrivalWeather,
  departureAirport,
  arrivalAirport,
  isLoading,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'departure' | 'arrival'>('departure');
  
  const hasWeather = departureWeather || arrivalWeather;
  
  return (
    <div className="weather-panel bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          🌤️ Weather
        </h3>
        <button
          onClick={onRefresh}
          disabled={isLoading || (!departureAirport && !arrivalAirport)}
          className="p-2 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh weather"
        >
          <svg
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <div className="text-gray-500">Fetching weather data...</div>
        </div>
      )}
      
      {/* No airports selected */}
      {!isLoading && !departureAirport && !arrivalAirport && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-2">🛫</div>
          <div>Select airports to view weather</div>
        </div>
      )}
      
      {/* Weather display */}
      {!isLoading && hasWeather && (
        <>
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('departure')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'departure'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={!departureWeather}
            >
              {departureAirport?.icao || 'DEP'}
            </button>
            <button
              onClick={() => setActiveTab('arrival')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'arrival'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={!arrivalWeather}
            >
              {arrivalAirport?.icao || 'ARR'}
            </button>
          </div>
          
          {/* Weather content */}
          <div className="p-4 max-h-96 overflow-auto">
            {activeTab === 'departure' && departureWeather && (
              <>
                {departureWeather.metar ? (
                  <MetarDisplay metar={departureWeather.metar} label="Departure" />
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No METAR available for {departureAirport?.icao}
                  </div>
                )}
                {departureWeather.taf && <TafDisplay taf={departureWeather.taf} />}
              </>
            )}
            
            {activeTab === 'arrival' && arrivalWeather && (
              <>
                {arrivalWeather.metar ? (
                  <MetarDisplay metar={arrivalWeather.metar} label="Arrival" />
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No METAR available for {arrivalAirport?.icao}
                  </div>
                )}
                {arrivalWeather.taf && <TafDisplay taf={arrivalWeather.taf} />}
              </>
            )}
          </div>
        </>
      )}
      
      {/* No weather data message */}
      {!isLoading && (departureAirport || arrivalAirport) && !hasWeather && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-2">📡</div>
          <div className="mb-2">No weather data available</div>
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:underline text-sm"
          >
            Click to fetch weather
          </button>
        </div>
      )}
    </div>
  );
};

export default WeatherPanel;
