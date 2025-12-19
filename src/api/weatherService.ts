import axios, { AxiosInstance } from 'axios';
import { Metar, Taf, TafPeriod, AirportWeather, Wind, Visibility, CloudLayer, WeatherPhenomena } from '@/types';

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY || '';
const WEATHER_API_BASE_URL = import.meta.env.VITE_WEATHER_API_URL || 'https://metar-taf.com/api';

// Cache durations
const METAR_CACHE_DURATION = 10 * 60 * 1000;  // 10 minutes
// TAF uses the same cache as METAR via AirportWeather

// ============================================================================
// CACHE
// ============================================================================

interface WeatherCacheEntry {
  data: AirportWeather;
  fetchedAt: Date;
  expiresAt: Date;
}

const weatherCache = new Map<string, WeatherCacheEntry>();

// ============================================================================
// API CLIENT
// ============================================================================

const weatherApi: AxiosInstance = axios.create({
  baseURL: WEATHER_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  params: {
    api_key: WEATHER_API_KEY,
  },
});

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface MetarApiResponse {
  results: number;
  data: Array<{
    icao: string;
    name: string;
    observed: string;
    raw_text: string;
    barometer?: { hg: number; mb: number };
    clouds?: Array<{ code: string; base_feet_agl?: number; text?: string }>;
    conditions?: Array<{ code: string }>;
    dewpoint?: { celsius: number; fahrenheit: number };
    elevation?: { feet: number; meters: number };
    flight_category?: string;
    humidity?: { percent: number };
    temperature?: { celsius: number; fahrenheit: number };
    visibility?: { miles: string; meters: string };
    wind?: {
      degrees: number;
      speed_kts: number;
      gust_kts?: number;
      variable?: boolean;
      variable_from?: number;
      variable_to?: number;
    };
  }>;
}

interface TafApiResponse {
  results: number;
  data: Array<{
    icao: string;
    name: string;
    raw_text: string;
    forecast: Array<{
      timestamp: {
        from: string;
        to: string;
      };
      change?: {
        indicator?: { code: string };
        probability?: number;
      };
      wind?: {
        degrees: number;
        speed_kts: number;
        gust_kts?: number;
      };
      visibility?: { miles: string };
      clouds?: Array<{ code: string; base_feet_agl?: number }>;
      conditions?: Array<{ code: string }>;
    }>;
  }>;
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

function parseCloudCoverage(code: string): 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV' {
  const coverageMap: Record<string, 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV'> = {
    'SKC': 'SKC',
    'CLR': 'SKC',
    'FEW': 'FEW',
    'SCT': 'SCT',
    'BKN': 'BKN',
    'OVC': 'OVC',
    'VV': 'VV',
  };
  return coverageMap[code?.toUpperCase()] || 'SKC';
}

function parseCloudType(text?: string): 'CB' | 'TCU' | undefined {
  if (!text) return undefined;
  const upper = text.toUpperCase();
  if (upper.includes('CB')) return 'CB';
  if (upper.includes('TCU')) return 'TCU';
  return undefined;
}

function parseFlightCategory(category?: string): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  const validCategories = ['VFR', 'MVFR', 'IFR', 'LIFR'];
  if (category && validCategories.includes(category.toUpperCase())) {
    return category.toUpperCase() as 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  }
  return 'VFR';
}

function isValidWeatherCode(code: string): code is WeatherPhenomena {
  const validCodes: WeatherPhenomena[] = [
    'RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'TS', 'SH',
    'GR', 'GS', 'FZ', 'BL', 'MI', 'PR', 'BC', 'DR'
  ];
  return validCodes.includes(code as WeatherPhenomena);
}

function parseTafChangeType(code?: string): 'FM' | 'TEMPO' | 'BECMG' | 'PROB' {
  const typeMap: Record<string, 'FM' | 'TEMPO' | 'BECMG' | 'PROB'> = {
    'FM': 'FM',
    'FROM': 'FM',
    'TEMPO': 'TEMPO',
    'BECMG': 'BECMG',
    'BECOMING': 'BECMG',
    'PROB': 'PROB',
  };
  return typeMap[code?.toUpperCase() || ''] || 'FM';
}

function extractRemarks(rawText: string): string | undefined {
  const rmkIndex = rawText.indexOf('RMK');
  if (rmkIndex !== -1) {
    return rawText.substring(rmkIndex + 4).trim();
  }
  return undefined;
}

function parseMetarResponse(data: MetarApiResponse['data'][0]): Metar {
  const wind: Wind = {
    direction: data.wind?.degrees || 0,
    speed: data.wind?.speed_kts || 0,
    gust: data.wind?.gust_kts,
    variable: data.wind?.variable ? {
      from: data.wind.variable_from || 0,
      to: data.wind.variable_to || 0,
    } : undefined,
  };

  const visibility: Visibility = {
    value: parseFloat(data.visibility?.miles || '10') || 10,
  };

  const clouds: CloudLayer[] = (data.clouds || []).map((cloud) => ({
    coverage: parseCloudCoverage(cloud.code),
    altitude: (cloud.base_feet_agl || 0) / 100,
    type: parseCloudType(cloud.text),
  }));

  const weather: WeatherPhenomena[] = (data.conditions || [])
    .map((c) => c.code as WeatherPhenomena)
    .filter((code): code is WeatherPhenomena => isValidWeatherCode(code));

  return {
    raw: data.raw_text,
    icao: data.icao,
    observationTime: new Date(data.observed),
    wind,
    visibility,
    weather,
    clouds,
    temperature: data.temperature?.celsius || 15,
    dewpoint: data.dewpoint?.celsius || 10,
    altimeter: data.barometer?.hg || 29.92,
    flightCategory: parseFlightCategory(data.flight_category),
    remarks: extractRemarks(data.raw_text),
  };
}

function parseTafResponse(data: TafApiResponse['data'][0]): Taf {
  const periods: TafPeriod[] = (data.forecast || []).map((fc) => {
    const wind: Wind = {
      direction: fc.wind?.degrees || 0,
      speed: fc.wind?.speed_kts || 0,
      gust: fc.wind?.gust_kts,
    };

    const visibility: Visibility = {
      value: parseFloat(fc.visibility?.miles || '10') || 10,
    };

    const clouds: CloudLayer[] = (fc.clouds || []).map((cloud) => ({
      coverage: parseCloudCoverage(cloud.code),
      altitude: (cloud.base_feet_agl || 0) / 100,
    }));

    const weather: WeatherPhenomena[] = (fc.conditions || [])
      .map((c) => c.code as WeatherPhenomena)
      .filter((code): code is WeatherPhenomena => isValidWeatherCode(code));

    return {
      type: parseTafChangeType(fc.change?.indicator?.code),
      probability: fc.change?.probability,
      from: new Date(fc.timestamp.from),
      to: new Date(fc.timestamp.to),
      wind,
      visibility,
      weather,
      clouds,
    };
  });

  // Parse valid times from raw TAF
  const now = new Date();
  const validFrom = periods.length > 0 ? periods[0].from : now;
  const validTo = periods.length > 0 ? periods[periods.length - 1].to : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    raw: data.raw_text,
    icao: data.icao,
    issueTime: now,
    validFrom,
    validTo,
    periods,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch METAR for an airport
 */
export async function fetchMetar(icao: string): Promise<Metar | null> {
  try {
    const response = await weatherApi.get<MetarApiResponse>('/metar', {
      params: { id: icao.toUpperCase() },
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    return parseMetarResponse(response.data.data[0]);
  } catch (error) {
    console.error(`Failed to fetch METAR for ${icao}:`, error);
    return null;
  }
}

/**
 * Fetch TAF for an airport
 */
export async function fetchTaf(icao: string): Promise<Taf | null> {
  try {
    const response = await weatherApi.get<TafApiResponse>('/taf', {
      params: { id: icao.toUpperCase() },
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    return parseTafResponse(response.data.data[0]);
  } catch (error) {
    console.error(`Failed to fetch TAF for ${icao}:`, error);
    return null;
  }
}

/**
 * Fetch both METAR and TAF for an airport (with caching)
 */
export async function fetchAirportWeather(icao: string): Promise<AirportWeather> {
  const upperIcao = icao.toUpperCase();
  
  // Check cache
  const cached = weatherCache.get(upperIcao);
  if (cached && cached.expiresAt > new Date()) {
    return cached.data;
  }
  
  // Fetch fresh data
  const [metar, taf] = await Promise.all([
    fetchMetar(upperIcao).catch(() => null),
    fetchTaf(upperIcao).catch(() => null),
  ]);

  const weather: AirportWeather = {
    icao: upperIcao,
    metar: metar || undefined,
    taf: taf || undefined,
    fetchedAt: new Date(),
  };
  
  // Cache the result
  weatherCache.set(upperIcao, {
    data: weather,
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + METAR_CACHE_DURATION),
  });

  return weather;
}

/**
 * Fetch weather for multiple airports
 */
export async function fetchMultipleAirportWeather(
  icaos: string[]
): Promise<Record<string, AirportWeather>> {
  const results: Record<string, AirportWeather> = {};

  const weatherPromises = icaos.map(async (icao) => {
    const weather = await fetchAirportWeather(icao);
    results[icao.toUpperCase()] = weather;
  });

  await Promise.all(weatherPromises);
  return results;
}

/**
 * Get wind from METAR
 */
export function getWindFromMetar(metar: Metar | null | undefined): Wind | null {
  if (!metar || !metar.wind) return null;
  return metar.wind;
}

/**
 * Get forecast wind at a specific time from TAF
 */
export function getWindFromTafAtTime(taf: Taf | null | undefined, time: Date): Wind | null {
  if (!taf || !taf.periods || taf.periods.length === 0) return null;
  
  // Find the period that contains the requested time
  const applicablePeriod = taf.periods.find(
    period => period.from <= time && period.to > time
  );
  
  if (applicablePeriod) {
    return applicablePeriod.wind;
  }
  
  // If no exact match, return the last period's wind
  return taf.periods[taf.periods.length - 1].wind;
}

/**
 * Calculate visibility category
 */
export function getVisibilityCategory(visibility: number): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  if (visibility >= 5) return 'VFR';
  if (visibility >= 3) return 'MVFR';
  if (visibility >= 1) return 'IFR';
  return 'LIFR';
}

/**
 * Check if weather is suitable for flight
 */
export function isWeatherSuitable(weather: AirportWeather): {
  suitable: boolean;
  category: string;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!weather.metar) {
    return {
      suitable: false,
      category: 'UNKNOWN',
      issues: ['No current weather data available'],
    };
  }
  
  const metar = weather.metar;
  
  // Check visibility
  if (metar.visibility.value < 1) {
    issues.push(`Low visibility: ${metar.visibility.value} SM`);
  }
  
  // Check ceiling
  const ceiling = metar.clouds.find(c => c.coverage === 'BKN' || c.coverage === 'OVC');
  if (ceiling && ceiling.altitude < 5) {
    issues.push(`Low ceiling: ${ceiling.altitude * 100} ft`);
  }
  
  // Check for significant weather
  if (metar.weather.includes('TS')) {
    issues.push('Thunderstorm activity');
  }
  if (metar.weather.includes('FZ')) {
    issues.push('Freezing precipitation');
  }
  if (metar.weather.includes('FG')) {
    issues.push('Fog present');
  }
  
  // Check wind
  if (metar.wind.speed > 35) {
    issues.push(`Strong winds: ${metar.wind.speed} kt`);
  }
  if (metar.wind.gust && metar.wind.gust > 45) {
    issues.push(`Strong gusts: ${metar.wind.gust} kt`);
  }
  
  return {
    suitable: issues.length === 0,
    category: metar.flightCategory,
    issues,
  };
}

/**
 * Clear weather cache
 */
export function clearWeatherCache(): void {
  weatherCache.clear();
}
