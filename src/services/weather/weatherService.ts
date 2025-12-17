/**
 * Fixed Weather API Integration
 * 
 * Correctly integrates with metar-taf.com API
 * API Documentation: https://metar-taf.com/api
 * 
 * API Key: DYAbhwvbj1CyKIWMDIIuFQD2BBvUjKYU
 */

import axios, { AxiosInstance } from 'axios';
import {
  Metar,
  Taf,
  TafPeriod,
  AirportWeather,
  Wind,
  Visibility,
  CloudLayer,
  WeatherPhenomena,
} from '@/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const METAR_TAF_API_KEY = 'DYAbhwvbj1CyKIWMDIIuFQD2BBvUjKYU';

// The metar-taf.com API base URL
// Note: API endpoint is https://metar-taf.com/api/v1
// We proxy through Vite to avoid CORS issues
const WEATHER_API_BASE_URL = '/api/weather';

// ============================================================================
// API CLIENT
// ============================================================================

const weatherApiClient: AxiosInstance = axios.create({
  baseURL: WEATHER_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  },
});

// Add API key to every request
weatherApiClient.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    api_key: METAR_TAF_API_KEY,
  };
  return config;
});

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface MetarTafApiResponse {
  // METAR specific
  icao?: string;
  raw_text?: string;
  observed?: string;
  
  // Wind
  wind?: {
    degrees?: number;
    speed_kts?: number;
    gust_kts?: number;
    variable?: boolean;
  };
  
  // Visibility
  visibility?: {
    miles?: string;
    meters?: string;
  };
  
  // Clouds
  clouds?: Array<{
    code?: string;
    base_feet_agl?: number;
    text?: string;
  }>;
  
  // Conditions
  conditions?: Array<{
    code?: string;
  }>;
  
  // Temperature
  temperature?: {
    celsius?: number;
  };
  dewpoint?: {
    celsius?: number;
  };
  
  // Barometer
  barometer?: {
    hg?: number;
    mb?: number;
  };
  
  // Flight category
  flight_category?: string;
}

interface TafApiResponse {
  icao?: string;
  raw_text?: string;
  forecast?: Array<{
    timestamp?: {
      from?: string;
      to?: string;
    };
    change?: {
      indicator?: {
        code?: string;
      };
      probability?: number;
    };
    wind?: {
      degrees?: number;
      speed_kts?: number;
      gust_kts?: number;
    };
    visibility?: {
      miles?: string;
    };
    clouds?: Array<{
      code?: string;
      base_feet_agl?: number;
    }>;
    conditions?: Array<{
      code?: string;
    }>;
  }>;
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

function parseCloudCoverage(code?: string): CloudLayer['coverage'] {
  const coverageMap: Record<string, CloudLayer['coverage']> = {
    'SKC': 'SKC',
    'CLR': 'CLR',
    'FEW': 'FEW',
    'SCT': 'SCT',
    'BKN': 'BKN',
    'OVC': 'OVC',
  };
  return coverageMap[code?.toUpperCase() || ''] || 'FEW';
}

function parseFlightCategory(category?: string): Metar['flightCategory'] {
  const categoryMap: Record<string, Metar['flightCategory']> = {
    'VFR': 'VFR',
    'MVFR': 'MVFR',
    'IFR': 'IFR',
    'LIFR': 'LIFR',
  };
  return categoryMap[category?.toUpperCase() || ''] || 'VFR';
}

function parseTafChangeType(code?: string): TafPeriod['type'] {
  const typeMap: Record<string, TafPeriod['type']> = {
    'FM': 'FROM',
    'BECMG': 'BECMG',
    'TEMPO': 'TEMPO',
    'PROB': 'PROB',
  };
  return typeMap[code?.toUpperCase() || ''] || 'FROM';
}

const validWeatherCodes: WeatherPhenomena[] = [
  'RA', 'SN', 'DZ', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP',
  'FG', 'BR', 'HZ', 'FU', 'SA', 'DU', 'VA', 'PY',
  'TS', 'SQ', 'FC', 'SS', 'DS',
  '-RA', '+RA', '-SN', '+SN', '-DZ', '+DZ',
  'TSRA', '+TSRA', '-TSRA', 'TSSN', 'VCSH', 'VCTS',
];

function isValidWeatherCode(code: string): code is WeatherPhenomena {
  return validWeatherCodes.includes(code as WeatherPhenomena);
}

// ============================================================================
// METAR FETCHING
// ============================================================================

/**
 * Fetch METAR for a single airport
 */
export async function fetchMetar(icao: string): Promise<Metar | null> {
  try {
    const response = await weatherApiClient.get<{ data?: MetarTafApiResponse[] }>('/metar', {
      params: {
        id: icao.toUpperCase(),
      },
    });
    
    const data = response.data?.data?.[0];
    if (!data || !data.raw_text) {
      console.warn(`No METAR data for ${icao}`);
      return null;
    }
    
    return parseMetarData(data, icao);
  } catch (error) {
    console.error(`Failed to fetch METAR for ${icao}:`, error);
    return null;
  }
}

/**
 * Parse METAR response into typed object
 */
function parseMetarData(data: MetarTafApiResponse, icao: string): Metar {
  const wind: Wind = {
    direction: data.wind?.degrees ?? 0,
    speed: data.wind?.speed_kts ?? 0,
    gust: data.wind?.gust_kts,
    variable: data.wind?.variable,
  };
  
  const visibility: Visibility = {
    value: parseFloat(data.visibility?.miles || '10') || 10,
  };
  
  const clouds: CloudLayer[] = (data.clouds || []).map(cloud => ({
    coverage: parseCloudCoverage(cloud.code),
    altitude: Math.round((cloud.base_feet_agl || 0) / 100), // Convert to FL
    type: cloud.text,
  }));
  
  const weather: WeatherPhenomena[] = (data.conditions || [])
    .map(c => c.code as WeatherPhenomena)
    .filter((code): code is WeatherPhenomena => !!code && isValidWeatherCode(code));
  
  return {
    raw: data.raw_text || '',
    icao: data.icao || icao,
    observationTime: data.observed ? new Date(data.observed) : new Date(),
    wind,
    visibility,
    weather,
    clouds,
    temperature: data.temperature?.celsius ?? 15,
    dewpoint: data.dewpoint?.celsius ?? 10,
    altimeter: data.barometer?.hg ?? 29.92,
    flightCategory: parseFlightCategory(data.flight_category),
  };
}

// ============================================================================
// TAF FETCHING
// ============================================================================

/**
 * Fetch TAF for a single airport
 */
export async function fetchTaf(icao: string): Promise<Taf | null> {
  try {
    const response = await weatherApiClient.get<{ data?: TafApiResponse[] }>('/taf', {
      params: {
        id: icao.toUpperCase(),
      },
    });
    
    const data = response.data?.data?.[0];
    if (!data || !data.raw_text) {
      console.warn(`No TAF data for ${icao}`);
      return null;
    }
    
    return parseTafData(data, icao);
  } catch (error) {
    console.error(`Failed to fetch TAF for ${icao}:`, error);
    return null;
  }
}

/**
 * Parse TAF response into typed object
 */
function parseTafData(data: TafApiResponse, icao: string): Taf {
  const periods: TafPeriod[] = (data.forecast || []).map(fc => {
    const wind: Wind = {
      direction: fc.wind?.degrees ?? 0,
      speed: fc.wind?.speed_kts ?? 0,
      gust: fc.wind?.gust_kts,
    };
    
    const visibility: Visibility = {
      value: parseFloat(fc.visibility?.miles || '10') || 10,
    };
    
    const clouds: CloudLayer[] = (fc.clouds || []).map(cloud => ({
      coverage: parseCloudCoverage(cloud.code),
      altitude: Math.round((cloud.base_feet_agl || 0) / 100),
    }));
    
    const weather: WeatherPhenomena[] = (fc.conditions || [])
      .map(c => c.code as WeatherPhenomena)
      .filter((code): code is WeatherPhenomena => !!code && isValidWeatherCode(code));
    
    return {
      type: parseTafChangeType(fc.change?.indicator?.code),
      probability: fc.change?.probability,
      from: fc.timestamp?.from ? new Date(fc.timestamp.from) : new Date(),
      to: fc.timestamp?.to ? new Date(fc.timestamp.to) : new Date(),
      wind,
      visibility,
      weather,
      clouds,
    };
  });
  
  // Parse validity from raw TAF
  const now = new Date();
  let validFrom = now;
  let validTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  if (periods.length > 0) {
    validFrom = periods[0].from;
    validTo = periods[periods.length - 1].to;
  }
  
  return {
    raw: data.raw_text || '',
    icao: data.icao || icao,
    issueTime: now,
    validFrom,
    validTo,
    periods,
  };
}

// ============================================================================
// COMBINED FETCH
// ============================================================================

/**
 * Fetch both METAR and TAF for an airport
 */
export async function fetchAirportWeather(icao: string): Promise<AirportWeather> {
  const [metar, taf] = await Promise.all([
    fetchMetar(icao).catch(err => {
      console.error(`METAR fetch failed for ${icao}:`, err);
      return null;
    }),
    fetchTaf(icao).catch(err => {
      console.error(`TAF fetch failed for ${icao}:`, err);
      return null;
    }),
  ]);
  
  return {
    icao: icao.toUpperCase(),
    metar: metar || undefined,
    taf: taf || undefined,
    fetchedAt: new Date(),
  };
}

/**
 * Fetch weather for multiple airports
 */
export async function fetchMultipleAirportWeather(
  icaos: string[]
): Promise<Record<string, AirportWeather>> {
  const results: Record<string, AirportWeather> = {};
  
  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < icaos.length; i += batchSize) {
    const batch = icaos.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(icao => fetchAirportWeather(icao))
    );
    
    batchResults.forEach(weather => {
      results[weather.icao] = weather;
    });
  }
  
  return results;
}

// ============================================================================
// DECODED WEATHER UTILITIES
// ============================================================================

/**
 * Get human-readable wind description
 */
export function formatWind(wind: Wind): string {
  if (wind.variable) {
    return `Variable at ${wind.speed} knots`;
  }
  
  const direction = wind.direction.toString().padStart(3, '0');
  let result = `${direction}° at ${wind.speed} knots`;
  
  if (wind.gust) {
    result += `, gusting ${wind.gust} knots`;
  }
  
  return result;
}

/**
 * Get human-readable visibility description
 */
export function formatVisibility(visibility: Visibility): string {
  if (visibility.value >= 10) {
    return '10+ statute miles';
  }
  return `${visibility.value} statute miles`;
}

/**
 * Get weather phenomenon description
 */
export function getWeatherDescription(code: WeatherPhenomena): string {
  const descriptions: Record<string, string> = {
    'RA': 'Rain',
    'SN': 'Snow',
    'DZ': 'Drizzle',
    'FG': 'Fog',
    'BR': 'Mist',
    'HZ': 'Haze',
    'TS': 'Thunderstorm',
    '+RA': 'Heavy Rain',
    '-RA': 'Light Rain',
    '+SN': 'Heavy Snow',
    '-SN': 'Light Snow',
    'TSRA': 'Thunderstorm with Rain',
    'VCSH': 'Showers in Vicinity',
    'VCTS': 'Thunderstorm in Vicinity',
  };
  
  return descriptions[code] || code;
}

/**
 * Get flight category color class
 */
export function getFlightCategoryColor(category: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (category) {
    case 'VFR':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'VFR' };
    case 'MVFR':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Marginal VFR' };
    case 'IFR':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'IFR' };
    case 'LIFR':
      return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Low IFR' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unknown' };
  }
}
