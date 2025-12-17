/**
 * Weather API Service
 * 
 * Fetches METAR and TAF data from metar-taf.com API
 * Parses raw weather data into typed structures
 */

import { weatherApi, handleApiError, withRetry } from './client';
import {
  Metar,
  Taf,
  TafPeriod,
  AirportWeather,
  Wind,
  Visibility,
  CloudLayer,
  WeatherPhenomena,
  MetarApiResponse,
  TafApiResponse,
} from '@/types';

/**
 * Fetch METAR for an airport
 */
export async function fetchMetar(icao: string): Promise<Metar | null> {
  try {
    const response = await withRetry(() =>
      weatherApi.get<MetarApiResponse>('/metar', {
        params: { id: icao.toUpperCase() },
      })
    );

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    const data = response.data.data[0];
    return parseMetarResponse(data);
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Fetch TAF for an airport
 */
export async function fetchTaf(icao: string): Promise<Taf | null> {
  try {
    const response = await withRetry(() =>
      weatherApi.get<TafApiResponse>('/taf', {
        params: { id: icao.toUpperCase() },
      })
    );

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    const data = response.data.data[0];
    return parseTafResponse(data);
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Fetch both METAR and TAF for an airport
 */
export async function fetchAirportWeather(icao: string): Promise<AirportWeather> {
  const [metar, taf] = await Promise.all([
    fetchMetar(icao).catch(() => null),
    fetchTaf(icao).catch(() => null),
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

  const weatherPromises = icaos.map(async (icao) => {
    const weather = await fetchAirportWeather(icao);
    results[icao.toUpperCase()] = weather;
  });

  await Promise.all(weatherPromises);
  return results;
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

function parseMetarResponse(data: MetarApiResponse['data'][0]): Metar {
  const wind: Wind = {
    direction: data.wind?.degrees || 0,
    speed: data.wind?.speed_kts || 0,
    gust: data.wind?.gust_kts,
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

  // Extract valid times from raw TAF
  const rawLines = data.raw_text.split('\n');
  const validLine = rawLines.find((line) => line.includes('/'));
  const validMatch = validLine?.match(/(\d{6})\/(\d{6})/);

  const now = new Date();
  let validFrom = now;
  let validTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (validMatch) {
    validFrom = parseTafTime(validMatch[1], now);
    validTo = parseTafTime(validMatch[2], now);
  }

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
// HELPER FUNCTIONS
// ============================================================================

function parseCloudCoverage(
  code: string
): 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV' {
  const upper = code.toUpperCase();
  switch (upper) {
    case 'SKC':
    case 'CLR':
    case 'NCD':
      return 'SKC';
    case 'FEW':
      return 'FEW';
    case 'SCT':
      return 'SCT';
    case 'BKN':
      return 'BKN';
    case 'OVC':
      return 'OVC';
    case 'VV':
      return 'VV';
    default:
      return 'SKC';
  }
}

function parseCloudType(text?: string): 'CB' | 'TCU' | undefined {
  if (!text) return undefined;
  const upper = text.toUpperCase();
  if (upper.includes('CB') || upper.includes('CUMULONIMBUS')) return 'CB';
  if (upper.includes('TCU') || upper.includes('TOWERING')) return 'TCU';
  return undefined;
}

function parseFlightCategory(
  category?: string
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  switch (category?.toUpperCase()) {
    case 'VFR':
      return 'VFR';
    case 'MVFR':
      return 'MVFR';
    case 'IFR':
      return 'IFR';
    case 'LIFR':
      return 'LIFR';
    default:
      return 'VFR';
  }
}

function parseTafChangeType(code?: string): 'FM' | 'TEMPO' | 'BECMG' | 'PROB' {
  switch (code?.toUpperCase()) {
    case 'FM':
      return 'FM';
    case 'TEMPO':
      return 'TEMPO';
    case 'BECMG':
      return 'BECMG';
    case 'PROB':
      return 'PROB';
    default:
      return 'FM';
  }
}

function parseTafTime(timeStr: string, reference: Date): Date {
  // TAF time format: DDHHMM (day, hour, minute)
  const day = parseInt(timeStr.substring(0, 2), 10);
  const hour = parseInt(timeStr.substring(2, 4), 10);
  const minute = parseInt(timeStr.substring(4, 6), 10) || 0;

  const result = new Date(reference);
  result.setUTCDate(day);
  result.setUTCHours(hour, minute, 0, 0);

  // Handle month rollover
  if (day < reference.getUTCDate()) {
    result.setUTCMonth(result.getUTCMonth() + 1);
  }

  return result;
}

function extractRemarks(raw: string): string | undefined {
  const rmkIndex = raw.indexOf('RMK');
  if (rmkIndex === -1) return undefined;
  return raw.substring(rmkIndex + 4).trim();
}

function isValidWeatherCode(code: string): boolean {
  const validCodes: WeatherPhenomena[] = [
    'RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'TS', 'SH',
    'GR', 'GS', 'FZ', 'BL', 'MI', 'PR', 'BC', 'DR',
  ];
  return validCodes.includes(code as WeatherPhenomena);
}

// ============================================================================
// WEATHER DECODING FOR DISPLAY
// ============================================================================

/**
 * Decode wind to human-readable string
 */
export function decodeWind(wind: Wind): string {
  if (wind.speed === 0) {
    return 'Calm';
  }

  let result = '';

  if (wind.direction === 0 || wind.variable) {
    result = 'Variable';
  } else {
    result = `${wind.direction.toString().padStart(3, '0')}°`;
  }

  result += ` at ${wind.speed} kt`;

  if (wind.gust) {
    result += ` gusting ${wind.gust} kt`;
  }

  return result;
}

/**
 * Decode visibility to human-readable string
 */
export function decodeVisibility(visibility: Visibility): string {
  if (visibility.value >= 10) {
    return '10+ SM';
  }

  const prefix = visibility.qualifier === 'M' ? '<' : visibility.qualifier === 'P' ? '>' : '';
  return `${prefix}${visibility.value} SM`;
}

/**
 * Decode clouds to human-readable string
 */
export function decodeClouds(clouds: CloudLayer[]): string {
  if (clouds.length === 0) {
    return 'Clear';
  }

  return clouds
    .map((cloud) => {
      const coverage = {
        SKC: 'Clear',
        FEW: 'Few',
        SCT: 'Scattered',
        BKN: 'Broken',
        OVC: 'Overcast',
        VV: 'Vertical Visibility',
      }[cloud.coverage];

      let result = `${coverage} at ${cloud.altitude * 100} ft`;

      if (cloud.type) {
        result += ` (${cloud.type})`;
      }

      return result;
    })
    .join(', ');
}

/**
 * Decode weather phenomena
 */
export function decodeWeather(weather: WeatherPhenomena[]): string {
  if (weather.length === 0) {
    return 'No significant weather';
  }

  const descriptions: Record<WeatherPhenomena, string> = {
    RA: 'Rain',
    SN: 'Snow',
    DZ: 'Drizzle',
    FG: 'Fog',
    BR: 'Mist',
    HZ: 'Haze',
    TS: 'Thunderstorm',
    SH: 'Showers',
    GR: 'Hail',
    GS: 'Small Hail',
    FZ: 'Freezing',
    BL: 'Blowing',
    MI: 'Shallow',
    PR: 'Partial',
    BC: 'Patches',
    DR: 'Drifting',
  };

  return weather.map((w) => descriptions[w] || w).join(', ');
}

/**
 * Get flight category color
 */
export function getFlightCategoryColor(category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'): string {
  switch (category) {
    case 'VFR':
      return '#22c55e'; // Green
    case 'MVFR':
      return '#3b82f6'; // Blue
    case 'IFR':
      return '#ef4444'; // Red
    case 'LIFR':
      return '#7c3aed'; // Purple
  }
}

/**
 * Full weather decode for display
 */
export function decodeFullMetar(metar: Metar): {
  wind: string;
  visibility: string;
  clouds: string;
  weather: string;
  temperature: string;
  altimeter: string;
  flightCategory: string;
} {
  return {
    wind: decodeWind(metar.wind),
    visibility: decodeVisibility(metar.visibility),
    clouds: decodeClouds(metar.clouds),
    weather: decodeWeather(metar.weather),
    temperature: `${metar.temperature}°C / ${Math.round(metar.temperature * 9/5 + 32)}°F (Dew: ${metar.dewpoint}°C)`,
    altimeter: `${metar.altimeter.toFixed(2)} inHg / ${Math.round(metar.altimeter * 33.8639)} hPa`,
    flightCategory: metar.flightCategory,
  };
}
