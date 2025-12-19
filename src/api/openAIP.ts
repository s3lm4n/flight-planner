import axios, { AxiosInstance, AxiosError } from 'axios';
import { EnhancedAirport, EnhancedRunway, RunwaySurfaceType } from '@/types/airport';
import { Coordinate } from '@/types';

const OPENAIP_CLIENT_ID = import.meta.env.VITE_OPENAIP_CLIENT_ID || '';
const OPENAIP_API_BASE_URL = '/api/openaip';

const openAipApi: AxiosInstance = axios.create({
  baseURL: OPENAIP_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
    ...(OPENAIP_CLIENT_ID && { 'x-openaip-client-id': OPENAIP_CLIENT_ID }),
  },
});

// ============================================================================
// TYPES - OpenAIP Response Formats
// ============================================================================

interface OpenAIPGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

interface OpenAIPRunway {
  designator: string;
  trueHeading: number;
  alignedTrueNorth: boolean;
  operations: number;
  mainRunway: boolean;
  turnDirection?: number;
  landingOnly: boolean;
  takeOffOnly: boolean;
  dimension: {
    length: {
      value: number;
      unit: number; // 1 = meters, 2 = feet
    };
    width: {
      value: number;
      unit: number;
    };
  };
  surface: {
    mainComposite: number;
    mainType: number;
    condition: number;
  };
  strength?: {
    value: number;
    unit: number;
  };
  thresholdCoordinate?: {
    lat: number;
    lon: number;
  };
  thresholdElevation?: {
    value: number;
    unit: number;
  };
}

interface OpenAIPFrequency {
  value: number;
  unit: number;
  type: number;
  name?: string;
  primary: boolean;
}

interface OpenAIPAirportResponse {
  _id: string;
  name: string;
  icaoCode?: string;
  iataCode?: string;
  altIdentifier?: string;
  type: number;
  country: string;
  geometry: OpenAIPGeometry;
  elevation?: {
    value: number;
    unit: number; // 1 = meters, 6 = feet
  };
  magneticDeclination?: number;
  runways?: OpenAIPRunway[];
  frequencies?: OpenAIPFrequency[];
  lastUpdated?: string;
}

interface OpenAIPSearchResponse {
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
  items: OpenAIPAirportResponse[];
}

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  fetchedAt: Date;
  expiresAt: Date;
}

const airportCache = new Map<string, CacheEntry<EnhancedAirport>>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false;
  return new Date() < entry.expiresAt;
}

// ============================================================================
// SURFACE TYPE MAPPING
// ============================================================================

const SURFACE_MAP: Record<number, RunwaySurfaceType> = {
  0: 'UNKNOWN',
  1: 'GRS',    // Grass
  2: 'SAND',   // Sand
  3: 'CLAY',   // Clay
  4: 'UNKNOWN', // Silt
  5: 'GRV',    // Gravel
  6: 'DIRT',   // Dirt
  7: 'ASP',    // Asphalt
  8: 'BIT',    // Bitumen
  9: 'BIT',    // Brick
  10: 'ASP',   // Macadam
  11: 'UNKNOWN', // Stone
  12: 'UNKNOWN', // Coral
  13: 'UNKNOWN', // Shell
  14: 'UNKNOWN', // Laterite
  15: 'CON',   // Concrete
  16: 'ICE',   // Ice
  17: 'UNKNOWN', // Snow
  18: 'UNKNOWN', // Rubber
  19: 'UNKNOWN', // Metal
  20: 'COP',   // Composite (Landing Mat)
  21: 'WATER', // Water
};

// ============================================================================
// AIRPORT TYPE MAPPING
// ============================================================================

function mapAirportType(type: number): EnhancedAirport['type'] {
  switch (type) {
    case 0: return 'CLOSED';
    case 1: return 'SMALL_AIRPORT';    // Airfield civil
    case 2: return 'SMALL_AIRPORT';    // Airfield military
    case 3: return 'MEDIUM_AIRPORT';   // International airport
    case 4: return 'HELIPORT';
    case 5: return 'SMALL_AIRPORT';    // Glider site
    case 6: return 'SMALL_AIRPORT';    // Ultralight site
    case 7: return 'SEAPLANE_BASE';
    case 8: return 'SMALL_AIRPORT';    // Aerodrome
    case 9: return 'LARGE_AIRPORT';    // International airport
    default: return 'SMALL_AIRPORT';
  }
}

// ============================================================================
// FREQUENCY TYPE MAPPING
// ============================================================================

function mapFrequencyType(type: number): string {
  switch (type) {
    case 0: return 'approach';
    case 1: return 'apron';
    case 2: return 'arrival';
    case 3: return 'atis';
    case 4: return 'clearance';
    case 5: return 'departure';
    case 6: return 'fis';
    case 7: return 'gliding';
    case 8: return 'ground';
    case 9: return 'info';
    case 10: return 'multicom';
    case 11: return 'other';
    case 12: return 'radar';
    case 13: return 'tower';
    case 14: return 'uas';
    case 15: return 'unicom';
    default: return 'other';
  }
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

function convertToMeters(value: number, unit: number): number {
  // Unit: 1 = meters, 2 = feet
  if (unit === 2) {
    return value * 0.3048;
  }
  return value;
}

function convertToFeet(value: number, unit: number): number {
  // Unit: 1 = meters, 6 = feet
  if (unit === 1) {
    return value * 3.28084;
  }
  return value;
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

function parseOpenAIPRunway(runway: OpenAIPRunway, airportElevation: number): EnhancedRunway {
  const lengthMeters = convertToMeters(
    runway.dimension.length.value,
    runway.dimension.length.unit
  );
  const widthMeters = convertToMeters(
    runway.dimension.width.value,
    runway.dimension.width.unit
  );
  
  const surface = SURFACE_MAP[runway.surface.mainType] || 'UNKNOWN';
  
  // Calculate reciprocal heading
  const reciprocalHeading = (runway.trueHeading + 180) % 360;
  
  // Parse designator and create reciprocal
  const designator = runway.designator || '';
  let reciprocalDesignator = '';
  
  // Handle standard runway designators (01-36, with optional L/R/C)
  const designatorMatch = designator.match(/^(\d{1,2})([LRC]?)$/);
  if (designatorMatch) {
    const num = parseInt(designatorMatch[1], 10);
    const suffix = designatorMatch[2];
    const recipNum = ((num + 17) % 36) + 1;
    const recipSuffix = suffix === 'L' ? 'R' : suffix === 'R' ? 'L' : suffix;
    reciprocalDesignator = `${recipNum.toString().padStart(2, '0')}${recipSuffix}`;
  } else {
    reciprocalDesignator = designator;
  }
  
  // Threshold coordinates
  const thresholdPosition: Coordinate = runway.thresholdCoordinate || { lat: 0, lon: 0 };
  
  // Calculate threshold elevation
  let thresholdElevation = airportElevation;
  if (runway.thresholdElevation) {
    thresholdElevation = convertToFeet(
      runway.thresholdElevation.value,
      runway.thresholdElevation.unit
    );
  }
  
  return {
    id: `${designator}/${reciprocalDesignator}`,
    designator,
    reciprocalDesignator,
    lengthMeters: Math.round(lengthMeters),
    widthMeters: Math.round(widthMeters),
    surface,
    headingTrue: Math.round(runway.trueHeading),
    headingMagnetic: Math.round(runway.trueHeading), // Will be adjusted by mag var
    reciprocalHeadingTrue: Math.round(reciprocalHeading),
    reciprocalHeadingMagnetic: Math.round(reciprocalHeading),
    thresholdElevation: Math.round(thresholdElevation),
    reciprocalThresholdElevation: Math.round(thresholdElevation),
    thresholdPosition,
    reciprocalThresholdPosition: thresholdPosition, // Approximate
    status: 'OPEN',
    lighting: true, // Assume lighting unless specified
    ils: false,
    tora: Math.round(lengthMeters),
    toda: Math.round(lengthMeters),
    asda: Math.round(lengthMeters),
    lda: Math.round(lengthMeters),
  };
}

function parseOpenAIPAirport(data: OpenAIPAirportResponse): EnhancedAirport | null {
  // Skip airports without ICAO code
  if (!data.icaoCode) {
    return null;
  }
  
  // Get coordinates
  const [lon, lat] = data.geometry.coordinates;
  
  // Get elevation in feet
  let elevationFeet = 0;
  if (data.elevation) {
    elevationFeet = convertToFeet(data.elevation.value, data.elevation.unit);
  }
  
  // Parse runways
  const runways: EnhancedRunway[] = (data.runways || [])
    .map(rwy => parseOpenAIPRunway(rwy, elevationFeet))
    .filter(rwy => rwy.lengthMeters > 0);
  
  // Parse frequencies
  const frequencies: EnhancedAirport['frequencies'] = {};
  for (const freq of data.frequencies || []) {
    const freqType = mapFrequencyType(freq.type);
    const freqValue = freq.value / 1000; // Convert kHz to MHz
    
    switch (freqType) {
      case 'atis':
        frequencies.atis = freqValue;
        break;
      case 'ground':
        frequencies.ground = freqValue;
        break;
      case 'tower':
        frequencies.tower = freqValue;
        break;
      case 'approach':
        frequencies.approach = freqValue;
        break;
      case 'departure':
        frequencies.departure = freqValue;
        break;
      case 'clearance':
        frequencies.clearance = freqValue;
        break;
    }
  }
  
  // Apply magnetic declination to runway headings if available
  const magVar = data.magneticDeclination || 0;
  for (const runway of runways) {
    runway.headingMagnetic = Math.round((runway.headingTrue - magVar + 360) % 360);
    runway.reciprocalHeadingMagnetic = Math.round((runway.reciprocalHeadingTrue - magVar + 360) % 360);
  }
  
  return {
    icao: data.icaoCode.toUpperCase(),
    iata: data.iataCode || undefined,
    name: data.name,
    city: '', // OpenAIP doesn't provide city separately
    region: undefined,
    country: data.country,
    countryCode: data.country,
    position: { lat, lon },
    elevation: Math.round(elevationFeet),
    magneticVariation: magVar,
    type: mapAirportType(data.type),
    timezone: '', // Not provided by OpenAIP
    runways,
    frequencies: Object.keys(frequencies).length > 0 ? frequencies : undefined,
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch airport by ICAO code from OpenAIP
 * This is the authoritative source for airport data
 */
export async function fetchAirportFromOpenAIP(icao: string): Promise<EnhancedAirport | null> {
  const upperIcao = icao.toUpperCase();
  
  const cached = airportCache.get(upperIcao);
  if (isCacheValid(cached)) {
    return cached.data;
  }
  
  try {
    
    const response = await openAipApi.get<OpenAIPSearchResponse>('/airports', {
      params: {
        icaoCode: upperIcao,
        limit: 1,
      },
    });
    
    if (!response.data?.items || response.data.items.length === 0) {
      console.warn(`[OpenAIP] Airport not found: ${upperIcao}`);
      return null;
    }
    
    const airport = parseOpenAIPAirport(response.data.items[0]);
    
    if (airport) {
      // Cache the result
      const now = new Date();
      airportCache.set(upperIcao, {
        data: airport,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_DURATION_MS),
      });
    }
    
    return airport;
  } catch (error) {
    handleOpenAIPError(error, `airport ${upperIcao}`);
    return null;
  }
}

/**
 * Search airports by query (name, ICAO, IATA)
 */
export async function searchAirportsOpenAIP(
  query: string,
  limit: number = 20
): Promise<EnhancedAirport[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await openAipApi.get<OpenAIPSearchResponse>('/airports', {
      params: {
        search: query,
        limit,
        sortBy: 'name',
        sortDesc: false,
      },
    });
    
    if (!response.data?.items) return [];
    
    return response.data.items
      .map(parseOpenAIPAirport)
      .filter((a): a is EnhancedAirport => a !== null);
  } catch (error) {
    console.error('[OpenAIP] Search failed:', error);
    return [];
  }
}

/**
 * Fetch airports within a bounding box
 */
export async function fetchAirportsInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  limit: number = 100
): Promise<EnhancedAirport[]> {
  try {
    const response = await openAipApi.get<OpenAIPSearchResponse>('/airports', {
      params: {
        pos: `${(bounds.north + bounds.south) / 2},${(bounds.east + bounds.west) / 2}`,
        dist: calculateBoundsRadius(bounds),
        limit,
      },
    });
    
    if (!response.data?.items) return [];
    
    return response.data.items
      .map(parseOpenAIPAirport)
      .filter((a): a is EnhancedAirport => a !== null);
  } catch (error) {
    console.error('[OpenAIP] Bounds search failed:', error);
    return [];
  }
}

/**
 * Validate ICAO code exists in OpenAIP
 */
export async function validateIcaoCode(icao: string): Promise<boolean> {
  const airport = await fetchAirportFromOpenAIP(icao);
  return airport !== null;
}

/**
 * Get runway information for an airport
 */
export async function getRunwaysFromOpenAIP(icao: string): Promise<EnhancedRunway[]> {
  const airport = await fetchAirportFromOpenAIP(icao);
  return airport?.runways || [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateBoundsRadius(bounds: { north: number; south: number; east: number; west: number }): number {
  // Approximate radius in km for the bounding box
  const latDiff = Math.abs(bounds.north - bounds.south);
  const lonDiff = Math.abs(bounds.east - bounds.west);
  const avgLat = (bounds.north + bounds.south) / 2;
  
  // Simple approximation
  const latKm = latDiff * 111;
  const lonKm = lonDiff * 111 * Math.cos(avgLat * Math.PI / 180);
  
  return Math.max(latKm, lonKm) / 2 * 1000; // Convert to meters
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function handleOpenAIPError(error: unknown, context: string): void {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      const status = axiosError.response.status;
      console.error(`[OpenAIP] ${context} - HTTP ${status}:`, axiosError.response.data);
      
      switch (status) {
        case 400:
          console.error(`[OpenAIP] Bad request for ${context}`);
          break;
        case 401:
        case 403:
          console.error('[OpenAIP] Authentication failed - check API key');
          break;
        case 404:
          console.warn(`[OpenAIP] Not found: ${context}`);
          break;
        case 429:
          console.error('[OpenAIP] Rate limit exceeded');
          break;
        case 500:
        case 502:
        case 503:
          console.error('[OpenAIP] Server error - service may be unavailable');
          break;
      }
    } else if (axiosError.request) {
      console.error(`[OpenAIP] No response for ${context}`);
    }
  } else {
    console.error(`[OpenAIP] Error for ${context}:`, error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { OpenAIPAirportResponse, OpenAIPRunway };
