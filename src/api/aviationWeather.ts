/**
 * Aviation Weather API Service
 * 
 * Uses the official AviationWeather.gov API (AWC)
 * API Documentation: https://aviationweather.gov/data/api/
 * 
 * Endpoints used:
 * - /api/data/metar - Get METAR reports
 * - /api/data/taf - Get TAF forecasts
 * 
 * Features:
 * - Fetch METAR and TAF using ICAO codes
 * - Support multiple airports per request
 * - JSON format responses
 * - Raw and decoded data
 * - Wind, visibility, weather phenomena extraction
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================================
// API CLIENT
// ============================================================================

// AviationWeather.gov API - proxied through Vite to avoid CORS
const AWC_API_BASE_URL = '/api/awc';

// Create axios instance for AWC API
const awcApi: AxiosInstance = axios.create({
  baseURL: AWC_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  },
});

// ============================================================================
// TYPES
// ============================================================================

export interface AWCMetarResponse {
  icaoId: string;
  reportTime: string;
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | string | null;
  altim: number | null;
  fltcat: string | null;
  wxString: string | null;
  presTend: string | null;
  clouds: AWCCloudLayer[];
  lat: number;
  lon: number;
  elev: number;
  prior: number;
  name: string;
}

export interface AWCCloudLayer {
  cover: string;
  base: number | null;
}

export interface AWCTafResponse {
  icaoId: string;
  rawTAF: string;
  reportTime: string;
  bulletinTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  lat: number;
  lon: number;
  elev: number;
  prior: number;
  name: string;
  fcsts: AWCForecast[];
}

export interface AWCForecast {
  timeFrom: string;
  timeTo: string;
  timeBec?: string;
  fcstChange?: string;
  wdir?: number | string;
  wspd?: number;
  wgst?: number;
  visib?: number | string;
  wxString?: string;
  clouds?: AWCCloudLayer[];
  wshearHgt?: number;
  wshearDir?: number;
  wshearSpd?: number;
}

// Decoded types for application use
export interface DecodedMetar {
  icao: string;
  raw: string;
  observationTime: Date;
  
  // Wind
  wind: {
    direction: number | 'VRB';
    speed: number;
    gust?: number;
    unit: 'KT';
  };
  
  // Visibility
  visibility: {
    value: number;
    unit: 'SM' | 'M';
    isUnlimited: boolean;
  };
  
  // Weather phenomena
  weather: string[];
  
  // Clouds
  clouds: {
    coverage: 'SKC' | 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';
    base: number | null;  // feet AGL
  }[];
  
  // Temperature
  temperature: number;  // Celsius
  dewpoint: number;     // Celsius
  
  // Pressure
  altimeter: number;    // inHg
  
  // Flight category
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null;
  
  // Position
  position: {
    lat: number;
    lon: number;
    elevation: number;
  };
  
  // Station info
  stationName: string;
}

export interface DecodedTaf {
  icao: string;
  raw: string;
  issueTime: Date;
  validFrom: Date;
  validTo: Date;
  
  // Forecasts
  forecasts: DecodedTafPeriod[];
  
  // Position
  position: {
    lat: number;
    lon: number;
    elevation: number;
  };
  
  stationName: string;
}

export interface DecodedTafPeriod {
  type: 'FROM' | 'TEMPO' | 'BECMG' | 'PROB';
  probability?: number;
  from: Date;
  to: Date;
  
  wind?: {
    direction: number | 'VRB';
    speed: number;
    gust?: number;
  };
  
  visibility?: {
    value: number;
    unit: 'SM' | 'M';
  };
  
  weather?: string[];
  
  clouds?: {
    coverage: string;
    base: number | null;
  }[];
  
  windShear?: {
    height: number;
    direction: number;
    speed: number;
  };
}

export interface AirportWeather {
  icao: string;
  metar: DecodedMetar | null;
  taf: DecodedTaf | null;
  fetchedAt: Date;
  error?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch METAR for one or more airports
 * @param icaos Single ICAO code or array of ICAO codes
 * @returns Array of decoded METAR reports
 */
export async function fetchMetar(icaos: string | string[]): Promise<DecodedMetar[]> {
  const icaoList = Array.isArray(icaos) ? icaos : [icaos];
  const icaoParam = icaoList.map(i => i.toUpperCase()).join(',');
  
  try {
    const response = await awcApi.get<AWCMetarResponse[]>('/metar', {
      params: {
        ids: icaoParam,
        format: 'json',
        taf: false,
        hours: 1,  // Get most recent hour of data
      },
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }
    
    return response.data.map(parseAWCMetar);
  } catch (error) {
    handleAWCError(error, 'METAR');
    return [];
  }
}

/**
 * Fetch TAF for one or more airports
 * @param icaos Single ICAO code or array of ICAO codes
 * @returns Array of decoded TAF forecasts
 */
export async function fetchTaf(icaos: string | string[]): Promise<DecodedTaf[]> {
  const icaoList = Array.isArray(icaos) ? icaos : [icaos];
  const icaoParam = icaoList.map(i => i.toUpperCase()).join(',');
  
  try {
    const response = await awcApi.get<AWCTafResponse[]>('/taf', {
      params: {
        ids: icaoParam,
        format: 'json',
      },
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }
    
    return response.data.map(parseAWCTaf);
  } catch (error) {
    handleAWCError(error, 'TAF');
    return [];
  }
}

/**
 * Fetch both METAR and TAF for an airport
 * @param icao ICAO code
 * @returns AirportWeather object with METAR and TAF
 */
export async function fetchAirportWeather(icao: string): Promise<AirportWeather> {
  const upperIcao = icao.toUpperCase();
  
  const result: AirportWeather = {
    icao: upperIcao,
    metar: null,
    taf: null,
    fetchedAt: new Date(),
  };
  
  try {
    // Fetch both in parallel
    const [metars, tafs] = await Promise.all([
      fetchMetar(upperIcao).catch((e) => {
        console.error(`METAR fetch failed for ${upperIcao}:`, e);
        return [];
      }),
      fetchTaf(upperIcao).catch((e) => {
        console.error(`TAF fetch failed for ${upperIcao}:`, e);
        return [];
      }),
    ]);
    
    result.metar = metars[0] || null;
    result.taf = tafs[0] || null;
    
    if (!result.metar && !result.taf) {
      result.error = `No weather data available for ${upperIcao}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error fetching weather';
  }
  
  return result;
}

/**
 * Fetch weather for multiple airports
 * @param icaos Array of ICAO codes
 * @returns Map of ICAO -> AirportWeather
 */
export async function fetchMultipleAirportWeather(
  icaos: string[]
): Promise<Map<string, AirportWeather>> {
  const results = new Map<string, AirportWeather>();
  
  if (icaos.length === 0) return results;
  
  const upperIcaos = icaos.map(i => i.toUpperCase());
  
  try {
    // Fetch all METARs and TAFs in two bulk requests
    const [metars, tafs] = await Promise.all([
      fetchMetar(upperIcaos).catch(() => []),
      fetchTaf(upperIcaos).catch(() => []),
    ]);
    
    // Create a map of ICAO -> METAR/TAF
    const metarMap = new Map(metars.map(m => [m.icao, m]));
    const tafMap = new Map(tafs.map(t => [t.icao, t]));
    
    // Build results for each airport
    for (const icao of upperIcaos) {
      const metar = metarMap.get(icao) || null;
      const taf = tafMap.get(icao) || null;
      
      results.set(icao, {
        icao,
        metar,
        taf,
        fetchedAt: new Date(),
        error: (!metar && !taf) ? `No weather data for ${icao}` : undefined,
      });
    }
  } catch (error) {
    // Set error for all airports
    for (const icao of upperIcaos) {
      results.set(icao, {
        icao,
        metar: null,
        taf: null,
        fetchedAt: new Date(),
        error: error instanceof Error ? error.message : 'Failed to fetch weather',
      });
    }
  }
  
  return results;
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse AWC METAR response to decoded format
 */
function parseAWCMetar(data: AWCMetarResponse): DecodedMetar {
  // Parse wind direction
  let windDirection: number | 'VRB' = 0;
  if (data.wdir === 'VRB' || data.wdir === 'VRB') {
    windDirection = 'VRB';
  } else if (typeof data.wdir === 'number') {
    windDirection = data.wdir;
  } else if (typeof data.wdir === 'string') {
    windDirection = parseInt(data.wdir, 10) || 0;
  }
  
  // Parse visibility
  let visValue = 10;
  let isUnlimited = false;
  if (data.visib === 'P6' || data.visib === '10+' || data.visib === 'P10') {
    visValue = 10;
    isUnlimited = true;
  } else if (typeof data.visib === 'number') {
    visValue = data.visib;
  } else if (typeof data.visib === 'string') {
    visValue = parseFloat(data.visib) || 10;
  }
  
  // Parse weather phenomena
  const weather: string[] = [];
  if (data.wxString) {
    weather.push(...data.wxString.split(' ').filter(w => w.length > 0));
  }
  
  // Parse clouds
  const clouds = (data.clouds || []).map(c => ({
    coverage: c.cover as DecodedMetar['clouds'][0]['coverage'],
    base: c.base,
  }));
  
  // Parse flight category
  let flightCategory: DecodedMetar['flightCategory'] = null;
  if (data.fltcat) {
    const cat = data.fltcat.toUpperCase();
    if (['VFR', 'MVFR', 'IFR', 'LIFR'].includes(cat)) {
      flightCategory = cat as DecodedMetar['flightCategory'];
    }
  }
  
  return {
    icao: data.icaoId,
    raw: data.rawOb,
    observationTime: new Date(data.reportTime),
    wind: {
      direction: windDirection,
      speed: data.wspd || 0,
      gust: data.wgst || undefined,
      unit: 'KT',
    },
    visibility: {
      value: visValue,
      unit: 'SM',
      isUnlimited,
    },
    weather,
    clouds,
    temperature: data.temp ?? 15,
    dewpoint: data.dewp ?? 10,
    altimeter: data.altim ?? 29.92,
    flightCategory,
    position: {
      lat: data.lat,
      lon: data.lon,
      elevation: data.elev,
    },
    stationName: data.name,
  };
}

/**
 * Parse AWC TAF response to decoded format
 */
function parseAWCTaf(data: AWCTafResponse): DecodedTaf {
  const forecasts: DecodedTafPeriod[] = (data.fcsts || []).map(fc => {
    // Determine forecast type
    let type: DecodedTafPeriod['type'] = 'FROM';
    let probability: number | undefined;
    
    if (fc.fcstChange) {
      const change = fc.fcstChange.toUpperCase();
      if (change.includes('TEMPO')) type = 'TEMPO';
      else if (change.includes('BECMG')) type = 'BECMG';
      else if (change.includes('PROB')) {
        type = 'PROB';
        const probMatch = change.match(/PROB(\d+)/);
        if (probMatch) probability = parseInt(probMatch[1], 10);
      }
    }
    
    // Parse wind
    let wind: DecodedTafPeriod['wind'] | undefined;
    if (fc.wdir !== undefined && fc.wspd !== undefined) {
      let wdir: number | 'VRB' = 0;
      if (fc.wdir === 'VRB') {
        wdir = 'VRB';
      } else if (typeof fc.wdir === 'number') {
        wdir = fc.wdir;
      } else {
        wdir = parseInt(fc.wdir, 10) || 0;
      }
      
      wind = {
        direction: wdir,
        speed: fc.wspd,
        gust: fc.wgst,
      };
    }
    
    // Parse visibility
    let visibility: DecodedTafPeriod['visibility'] | undefined;
    if (fc.visib !== undefined) {
      let visValue = 10;
      if (typeof fc.visib === 'number') {
        visValue = fc.visib;
      } else if (typeof fc.visib === 'string') {
        visValue = parseFloat(fc.visib) || 10;
      }
      visibility = { value: visValue, unit: 'SM' };
    }
    
    // Parse weather
    const weather = fc.wxString ? fc.wxString.split(' ').filter(w => w) : undefined;
    
    // Parse clouds
    const clouds = fc.clouds?.map(c => ({
      coverage: c.cover,
      base: c.base,
    }));
    
    // Parse wind shear
    let windShear: DecodedTafPeriod['windShear'] | undefined;
    if (fc.wshearHgt !== undefined) {
      windShear = {
        height: fc.wshearHgt,
        direction: fc.wshearDir || 0,
        speed: fc.wshearSpd || 0,
      };
    }
    
    return {
      type,
      probability,
      from: new Date(fc.timeFrom),
      to: new Date(fc.timeTo),
      wind,
      visibility,
      weather,
      clouds,
      windShear,
    };
  });
  
  return {
    icao: data.icaoId,
    raw: data.rawTAF,
    issueTime: new Date(data.reportTime),
    validFrom: new Date(data.validTimeFrom),
    validTo: new Date(data.validTimeTo),
    forecasts,
    position: {
      lat: data.lat,
      lon: data.lon,
      elevation: data.elev,
    },
    stationName: data.name,
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle AWC API errors
 */
function handleAWCError(error: unknown, dataType: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      const status = axiosError.response.status;
      
      switch (status) {
        case 400:
          throw new Error(`Invalid ${dataType} request. Check ICAO codes.`);
        case 404:
          throw new Error(`${dataType} data not found for the specified airports.`);
        case 429:
          throw new Error('Too many requests to AviationWeather.gov. Please wait.');
        case 500:
        case 502:
        case 503:
          throw new Error(`AviationWeather.gov ${dataType} service temporarily unavailable.`);
        default:
          throw new Error(`${dataType} API error (${status})`);
      }
    } else if (axiosError.request) {
      throw new Error(`No response from AviationWeather.gov. Check your internet connection.`);
    }
  }
  
  throw error instanceof Error ? error : new Error(`Unknown ${dataType} fetch error`);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract wind info from decoded METAR for display
 */
export function formatWind(metar: DecodedMetar): string {
  const { wind } = metar;
  
  if (wind.speed === 0) return 'Calm';
  
  const dirStr = wind.direction === 'VRB' ? 'VRB' : `${wind.direction}°`;
  let result = `${dirStr} at ${wind.speed} kt`;
  
  if (wind.gust) {
    result += ` gusting ${wind.gust} kt`;
  }
  
  return result;
}

/**
 * Get flight category color
 */
export function getFlightCategoryColor(category: DecodedMetar['flightCategory']): string {
  switch (category) {
    case 'VFR': return 'text-green-600';
    case 'MVFR': return 'text-blue-600';
    case 'IFR': return 'text-red-600';
    case 'LIFR': return 'text-purple-600';
    default: return 'text-gray-600';
  }
}

/**
 * Get flight category background color
 */
export function getFlightCategoryBgColor(category: DecodedMetar['flightCategory']): string {
  switch (category) {
    case 'VFR': return 'bg-green-100';
    case 'MVFR': return 'bg-blue-100';
    case 'IFR': return 'bg-red-100';
    case 'LIFR': return 'bg-purple-100';
    default: return 'bg-gray-100';
  }
}

/**
 * Format visibility for display (converted to KM)
 */
export function formatVisibility(vis: DecodedMetar['visibility']): string {
  if (vis.isUnlimited) return '10+ KM';
  
  // Convert SM to KM (1 SM = 1.60934 KM)
  if (vis.unit === 'SM') {
    const kmValue = vis.value * 1.60934;
    return `${kmValue.toFixed(1)} KM`;
  }
  
  // Already in meters, convert to KM
  if (vis.unit === 'M') {
    const kmValue = vis.value / 1000;
    return `${kmValue.toFixed(1)} KM`;
  }
  
  return `${vis.value} KM`;
}

/**
 * Format clouds for display
 */
export function formatClouds(clouds: DecodedMetar['clouds']): string {
  if (clouds.length === 0) return 'Clear';
  
  return clouds
    .map(c => {
      if (c.base === null) return c.coverage;
      return `${c.coverage}${String(c.base).padStart(3, '0')}`;
    })
    .join(' ');
}

/**
 * Check if weather is below minimums
 */
export function isBelowMinimums(metar: DecodedMetar): boolean {
  return metar.flightCategory === 'IFR' || metar.flightCategory === 'LIFR';
}
