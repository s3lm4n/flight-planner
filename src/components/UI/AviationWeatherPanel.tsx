/**
 * Aviation Weather Panel Component
 * 
 * Displays METAR and TAF weather information for departure and arrival airports.
 * Uses data from AviationWeather.gov API.
 * 
 * Features:
 * - Raw METAR/TAF display
 * - Decoded weather data (wind, visibility, clouds, etc.)
 * - Flight category indicators (VFR, MVFR, IFR, LIFR)
 * - Clear error handling when data fails to load
 * - Refresh capability
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Airport } from '@/types';
import { 
  fetchAirportWeather,
  AirportWeather,
  DecodedMetar,
  DecodedTaf,
  formatWind,
  formatVisibility,
  formatClouds,
  getFlightCategoryColor,
  getFlightCategoryBgColor,
} from '@/api/aviationWeather';

// ============================================================================
// TYPES
// ============================================================================

interface AviationWeatherPanelProps {
  departureAirport: Airport | null;
  arrivalAirport: Airport | null;
  onWeatherUpdate?: (departure: AirportWeather | null, arrival: AirportWeather | null) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AviationWeatherPanel: React.FC<AviationWeatherPanelProps> = ({
  departureAirport,
  arrivalAirport,
  onWeatherUpdate,
}) => {
  const [departureWeather, setDepartureWeather] = useState<AirportWeather | null>(null);
  const [arrivalWeather, setArrivalWeather] = useState<AirportWeather | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(30); // minutes until next refresh

  // Fetch weather for airports
  const fetchWeather = useCallback(async () => {
    const icaos: string[] = [];
    if (departureAirport) icaos.push(departureAirport.icao);
    if (arrivalAirport) icaos.push(arrivalAirport.icao);
    
    if (icaos.length === 0) {
      setDepartureWeather(null);
      setArrivalWeather(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await Promise.all([
        departureAirport ? fetchAirportWeather(departureAirport.icao) : null,
        arrivalAirport ? fetchAirportWeather(arrivalAirport.icao) : null,
      ]);
      
      const [depWx, arrWx] = results;
      
      setDepartureWeather(depWx);
      setArrivalWeather(arrWx);
      setLastUpdated(new Date());
      
      // Notify parent of weather update
      onWeatherUpdate?.(depWx, arrWx);
      
      // Check for any errors
      const errors: string[] = [];
      if (depWx?.error) errors.push(`Departure: ${depWx.error}`);
      if (arrWx?.error) errors.push(`Arrival: ${arrWx.error}`);
      if (errors.length > 0) {
        setError(errors.join('; '));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch weather';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [departureAirport, arrivalAirport, onWeatherUpdate]);

  // Auto-fetch when airports change
  useEffect(() => {
    fetchWeather();
  }, [departureAirport?.icao, arrivalAirport?.icao]);

  // Auto-refresh METAR every 30 minutes
  useEffect(() => {
    // Only set up interval if we have airports
    if (!departureAirport && !arrivalAirport) return;
    
    const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Reset countdown when weather is fetched
    setNextRefreshIn(30);
    
    const refreshIntervalId = setInterval(() => {
      console.log('Auto-refreshing METAR/TAF data...');
      fetchWeather();
      setNextRefreshIn(30); // Reset countdown after refresh
    }, REFRESH_INTERVAL_MS);
    
    // Update countdown every minute
    const countdownIntervalId = setInterval(() => {
      setNextRefreshIn(prev => Math.max(0, prev - 1));
    }, 60 * 1000); // Every minute
    
    // Cleanup on unmount or when airports change
    return () => {
      clearInterval(refreshIntervalId);
      clearInterval(countdownIntervalId);
    };
  }, [departureAirport?.icao, arrivalAirport?.icao, fetchWeather]);

  // Render nothing if no airports selected
  if (!departureAirport && !arrivalAirport) {
    return null;
  }

  return (
    <div className="aviation-weather-panel bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          🌤️ Aviation Weather
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <div className="text-cyan-100 text-xs text-right">
              <div>Updated: {lastUpdated.toLocaleTimeString()}</div>
              <div className="text-cyan-200">Next: {nextRefreshIn} min</div>
            </div>
          )}
          <button
            onClick={fetchWeather}
            disabled={isLoading}
            className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        )}

        {/* Departure weather */}
        {!isLoading && departureAirport && (
          <WeatherSection
            label="Departure"
            airport={departureAirport}
            weather={departureWeather}
          />
        )}

        {/* Arrival weather */}
        {!isLoading && arrivalAirport && (
          <WeatherSection
            label="Arrival"
            airport={arrivalAirport}
            weather={arrivalWeather}
          />
        )}

        {/* Data source attribution */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          Data from AviationWeather.gov
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WEATHER SECTION COMPONENT
// ============================================================================

interface WeatherSectionProps {
  label: string;
  airport: Airport;
  weather: AirportWeather | null;
}

const WeatherSection: React.FC<WeatherSectionProps> = ({ label, airport, weather }) => {
  const [showTaf, setShowTaf] = useState(false);

  if (!weather) {
    return (
      <div className="weather-section p-3 bg-gray-50 rounded">
        <div className="font-semibold text-gray-700 mb-2">
          {label}: {airport.icao}
        </div>
        <div className="text-gray-500 text-sm">No weather data available</div>
      </div>
    );
  }

  return (
    <div className="weather-section">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-gray-700">
          {label}: {airport.icao}
          <span className="text-gray-400 font-normal ml-2">{airport.name}</span>
        </div>
      </div>

      {/* Error for this airport */}
      {weather.error && !weather.metar && (
        <div className="text-red-600 text-sm py-2">{weather.error}</div>
      )}

      {/* METAR Display */}
      {weather.metar && (
        <MetarDisplay metar={weather.metar} />
      )}

      {/* TAF Toggle */}
      {weather.taf && (
        <div className="mt-3">
          <button
            onClick={() => setShowTaf(!showTaf)}
            className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
          >
            {showTaf ? '▼' : '▶'} TAF Forecast
          </button>
          {showTaf && <TafDisplay taf={weather.taf} />}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// METAR DISPLAY COMPONENT
// ============================================================================

interface MetarDisplayProps {
  metar: DecodedMetar;
}

const MetarDisplay: React.FC<MetarDisplayProps> = ({ metar }) => {
  const categoryColor = getFlightCategoryColor(metar.flightCategory);
  const categoryBg = getFlightCategoryBgColor(metar.flightCategory);

  return (
    <div className="metar-display">
      {/* Flight category badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">METAR</span>
        {metar.flightCategory && (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColor} ${categoryBg}`}>
            {metar.flightCategory}
          </span>
        )}
      </div>

      {/* Raw METAR */}
      <div className="text-xs font-mono bg-gray-100 p-2 rounded mb-3 break-all">
        {metar.raw}
      </div>

      {/* Decoded values grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Wind */}
        <div className="flex items-center gap-2">
          <span className="text-lg">💨</span>
          <div>
            <div className="text-xs text-gray-500">Wind</div>
            <div className="font-medium">{formatWind(metar)}</div>
          </div>
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-2">
          <span className="text-lg">👁️</span>
          <div>
            <div className="text-xs text-gray-500">Visibility</div>
            <div className="font-medium">{formatVisibility(metar.visibility)}</div>
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

        {/* Altimeter */}
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <div className="text-xs text-gray-500">Altimeter</div>
            <div className="font-medium">
              {metar.altimeter.toFixed(2)}" Hg
            </div>
          </div>
        </div>
      </div>

      {/* Clouds */}
      <div className="mt-3">
        <div className="text-xs text-gray-500 mb-1">Clouds</div>
        <div className="text-sm font-medium">{formatClouds(metar.clouds)}</div>
      </div>

      {/* Weather phenomena */}
      {metar.weather.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Weather</div>
          <div className="flex flex-wrap gap-2">
            {metar.weather.map((wx, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium"
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

// ============================================================================
// TAF DISPLAY COMPONENT
// ============================================================================

interface TafDisplayProps {
  taf: DecodedTaf;
}

const TafDisplay: React.FC<TafDisplayProps> = ({ taf }) => {
  return (
    <div className="taf-display mt-2 p-3 bg-gray-50 rounded">
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
        {taf.forecasts.slice(0, 5).map((period, index) => (
          <div key={index} className="text-xs p-2 bg-white rounded border">
            <div className="font-medium text-gray-700 mb-1">
              {period.type}
              {period.probability && ` ${period.probability}%`}
              {' - '}
              {period.from.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' to '}
              {period.to.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="flex flex-wrap gap-3 text-gray-600">
              {period.wind && (
                <span>
                  Wind: {period.wind.direction === 'VRB' ? 'VRB' : `${period.wind.direction}°`}
                  /{period.wind.speed}kt
                  {period.wind.gust && ` G${period.wind.gust}`}
                </span>
              )}
              {period.visibility && (
                <span>Vis: {(period.visibility.unit === 'SM' 
                  ? (period.visibility.value * 1.60934).toFixed(1) 
                  : period.visibility.unit === 'M'
                    ? (period.visibility.value / 1000).toFixed(1)
                    : period.visibility.value
                )} KM</span>
              )}
              {period.weather && period.weather.length > 0 && (
                <span>Wx: {period.weather.join(' ')}</span>
              )}
              {period.clouds && period.clouds.length > 0 && (
                <span>
                  Clouds: {period.clouds.map(c => 
                    c.base ? `${c.coverage}${String(c.base).padStart(3, '0')}` : c.coverage
                  ).join(' ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AviationWeatherPanel;
