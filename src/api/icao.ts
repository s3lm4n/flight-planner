/**
 * ICAO API Client
 * 
 * Integration with ICAO-compatible aviation data service for:
 * - Airport data (including runways)
 * - NOTAMs
 * - Airport information
 * 
 * SECURITY: API key is stored as Cloudflare Worker secret (ICAO_API_KEY)
 * The worker proxies requests and injects the key server-side.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  EnhancedAirport,
  EnhancedRunway,
  Notam,
  IcaoAirportResponse,
  IcaoRunwayResponse,
  IcaoNotamResponse,
  RunwaySurfaceType,
  NotamType,
  NotamSeverity,
  AirportType,
  AirportSearchFilters,
  AirportCacheEntry,
  NotamCacheEntry,
} from '@/types/airport';

// ============================================================================
// CONFIGURATION
// ============================================================================

// API key is injected server-side by Cloudflare Worker
// DO NOT hardcode API keys in frontend code
const ICAO_API_BASE_URL = '/api/icao';  // Proxied through Worker

// Cache durations
const AIRPORT_CACHE_DURATION = 24 * 60 * 60 * 1000;  // 24 hours
const NOTAM_CACHE_DURATION = 30 * 60 * 1000;          // 30 minutes

// European countries (ICAO prefixes)
const EUROPEAN_ICAO_PREFIXES = [
  // Western Europe
  'EG', // UK
  'EI', // Ireland
  'LF', // France
  'EB', // Belgium
  'EH', // Netherlands
  'ED', // Germany
  'LO', // Austria
  'LS', // Switzerland
  'LI', // Italy
  'LE', // Spain
  'LP', // Portugal
  
  // Northern Europe
  'EK', // Denmark
  'EN', // Norway
  'ES', // Sweden
  'EF', // Finland
  'BI', // Iceland
  
  // Eastern Europe
  'EP', // Poland
  'LK', // Czech Republic
  'LZ', // Slovakia
  'LH', // Hungary
  'LR', // Romania
  'LB', // Bulgaria
  'LW', // North Macedonia
  'LY', // Serbia
  'LD', // Croatia
  'LJ', // Slovenia
  'LA', // Albania
  'LQ', // Bosnia
  'LU', // Moldova
  'UK', // Ukraine
  'EY', // Lithuania
  'EV', // Latvia
  'EE', // Estonia
  'UM', // Belarus
  
  // Mediterranean
  'LG', // Greece
  'LC', // Cyprus
  'LM', // Malta
  
  // Turkey
  'LT', // Turkey
];

// ============================================================================
// CACHE
// ============================================================================

const airportCache = new Map<string, AirportCacheEntry>();
const notamCache = new Map<string, NotamCacheEntry>();
const allAirportsCache: { airports: EnhancedAirport[]; fetchedAt: Date | null } = {
  airports: [],
  fetchedAt: null,
};

// ============================================================================
// API CLIENT
// ============================================================================

// SECURITY: API key is injected server-side by Cloudflare Worker
// The frontend makes requests to /api/icao/* which are proxied by the worker
const icaoApi: AxiosInstance = axios.create({
  baseURL: ICAO_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // API key is NOT included here - it's added server-side by the Worker
  },
});

// Add response interceptor for error handling
icaoApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          console.error('ICAO API: Invalid API key');
          break;
        case 403:
          console.error('ICAO API: Access forbidden');
          break;
        case 404:
          console.error('ICAO API: Resource not found');
          break;
        case 429:
          console.error('ICAO API: Rate limit exceeded');
          break;
        default:
          console.error(`ICAO API: Error ${status}`);
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

function parseSurfaceType(surface: string): RunwaySurfaceType {
  const surfaceMap: Record<string, RunwaySurfaceType> = {
    'ASP': 'ASP',
    'ASPH': 'ASP',
    'ASPHALT': 'ASP',
    'CON': 'CON',
    'CONC': 'CON',
    'CONCRETE': 'CON',
    'GRS': 'GRS',
    'GRASS': 'GRS',
    'TURF': 'GRS',
    'GRV': 'GRV',
    'GRAVEL': 'GRV',
    'WATER': 'WATER',
    'ICE': 'ICE',
    'SAND': 'SAND',
    'DIRT': 'DIRT',
    'CLAY': 'CLAY',
  };
  
  const upper = surface?.toUpperCase() || '';
  return surfaceMap[upper] || 'UNKNOWN';
}

function parseAirportType(type: string): AirportType {
  const typeMap: Record<string, AirportType> = {
    'large_airport': 'LARGE_AIRPORT',
    'medium_airport': 'MEDIUM_AIRPORT',
    'small_airport': 'SMALL_AIRPORT',
    'heliport': 'HELIPORT',
    'seaplane_base': 'SEAPLANE_BASE',
    'closed': 'CLOSED',
  };
  
  return typeMap[type?.toLowerCase()] || 'SMALL_AIRPORT';
}

function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3048);
}

function parseRunway(runway: IcaoRunwayResponse): EnhancedRunway {
  const lengthMeters = feetToMeters(runway.length_ft);
  const widthMeters = feetToMeters(runway.width_ft);
  
  return {
    id: runway.runway_id || `${runway.le_ident}/${runway.he_ident}`,
    designator: runway.le_ident,
    reciprocalDesignator: runway.he_ident,
    lengthMeters,
    widthMeters,
    surface: parseSurfaceType(runway.surface),
    headingTrue: runway.le_heading_deg_true,
    headingMagnetic: runway.le_heading_deg_mag || runway.le_heading_deg_true,
    reciprocalHeadingTrue: runway.he_heading_deg_true,
    reciprocalHeadingMagnetic: runway.he_heading_deg_mag || runway.he_heading_deg_true,
    thresholdElevation: runway.le_elevation_ft,
    reciprocalThresholdElevation: runway.he_elevation_ft,
    thresholdPosition: {
      lat: runway.le_latitude,
      lon: runway.le_longitude,
    },
    reciprocalThresholdPosition: {
      lat: runway.he_latitude,
      lon: runway.he_longitude,
    },
    status: runway.closed ? 'CLOSED' : 'OPEN',
    lighting: runway.lighted,
    ils: false,  // Would need additional data
    tora: lengthMeters,
    toda: lengthMeters,
    asda: lengthMeters,
    lda: lengthMeters,
  };
}

function parseAirport(data: IcaoAirportResponse): EnhancedAirport {
  return {
    icao: data.icao,
    iata: data.iata,
    name: data.name,
    city: data.city || '',
    region: data.region,
    country: data.country,
    countryCode: data.country_code,
    position: {
      lat: data.latitude,
      lon: data.longitude,
    },
    elevation: data.elevation_ft,
    magneticVariation: data.magnetic_variation || 0,
    type: parseAirportType(data.type),
    timezone: data.timezone || 'UTC',
    runways: (data.runways || []).map(parseRunway),
    lastUpdated: new Date(),
  };
}

function parseNotamType(type: string): NotamType {
  const typeMap: Record<string, NotamType> = {
    'RWY': 'RUNWAY',
    'RUNWAY': 'RUNWAY',
    'TWY': 'TAXIWAY',
    'TAXIWAY': 'TAXIWAY',
    'APRON': 'APRON',
    'LIGHTING': 'LIGHTING',
    'NAV': 'NAVIGATION',
    'NAVIGATION': 'NAVIGATION',
    'AIRSPACE': 'AIRSPACE',
    'OBST': 'OBSTACLE',
    'OBSTACLE': 'OBSTACLE',
    'PROC': 'PROCEDURE',
    'PROCEDURE': 'PROCEDURE',
  };
  
  return typeMap[type?.toUpperCase()] || 'OTHER';
}

function parseNotamSeverity(text: string): NotamSeverity {
  const lower = text.toLowerCase();
  if (lower.includes('closed') || lower.includes('unserviceable') || lower.includes('out of service')) {
    return 'CRITICAL';
  }
  if (lower.includes('restricted') || lower.includes('limited') || lower.includes('reduced')) {
    return 'WARNING';
  }
  return 'INFO';
}

function parseNotam(data: IcaoNotamResponse): Notam {
  const text = data.notam_text || data.notam_raw || '';
  const severity = parseNotamSeverity(text);
  
  // Check if NOTAM affects runway operations
  const affectsRunway = /RWY|RUNWAY|TWY|TAXIWAY/i.test(text);
  const affectsTakeoff = /CLSD|CLOSED|T\/O|TAKEOFF|DEPARTURE/i.test(text);
  const affectsLanding = /CLSD|CLOSED|LDG|LANDING|APPROACH/i.test(text);
  
  // Try to extract runway identifier
  const runwayMatch = text.match(/RWY\s*(\d{2}[LRC]?)/i);
  
  return {
    id: data.id,
    icao: data.icao,
    type: parseNotamType(data.type),
    severity,
    text: data.notam_text || data.notam_raw,
    rawText: data.notam_raw,
    effectiveFrom: new Date(data.effective_start),
    effectiveTo: new Date(data.effective_end),
    isPermanent: data.is_permanent,
    affectedRunway: runwayMatch ? runwayMatch[1] : undefined,
    impactsRunway: affectsRunway,
    impactsTakeoff: affectsTakeoff,
    impactsLanding: affectsLanding,
    created: new Date(data.created),
    lastModified: new Date(data.modified),
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch a single airport by ICAO code
 */
export async function fetchAirport(icao: string): Promise<EnhancedAirport | null> {
  // Check cache
  const cached = airportCache.get(icao);
  if (cached && cached.expiresAt > new Date()) {
    return cached.airport;
  }
  
  try {
    const response = await icaoApi.get<IcaoAirportResponse>(`/airports/${icao.toUpperCase()}`);
    
    if (!response.data) {
      return null;
    }
    
    const airport = parseAirport(response.data);
    
    // Cache the result
    airportCache.set(icao.toUpperCase(), {
      airport,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + AIRPORT_CACHE_DURATION),
    });
    
    return airport;
  } catch (error) {
    console.error(`Failed to fetch airport ${icao}:`, error);
    return null;
  }
}

/**
 * Fetch all European airports (including Turkey)
 */
export async function fetchEuropeanAirports(): Promise<EnhancedAirport[]> {
  // Check cache (refresh every 24 hours)
  if (
    allAirportsCache.airports.length > 0 &&
    allAirportsCache.fetchedAt &&
    Date.now() - allAirportsCache.fetchedAt.getTime() < AIRPORT_CACHE_DURATION
  ) {
    return allAirportsCache.airports;
  }
  
  try {
    // Fetch airports for each European prefix
    const allAirports: EnhancedAirport[] = [];
    const batchSize = 5;  // Process 5 prefixes at a time
    
    for (let i = 0; i < EUROPEAN_ICAO_PREFIXES.length; i += batchSize) {
      const batch = EUROPEAN_ICAO_PREFIXES.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (prefix) => {
        try {
          const response = await icaoApi.get<{ airports: IcaoAirportResponse[] }>('/airports', {
            params: {
              prefix,
              include_runways: true,
              limit: 1000,
            },
          });
          
          return (response.data.airports || []).map(parseAirport);
        } catch (error) {
          console.warn(`Failed to fetch airports for prefix ${prefix}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(airports => allAirports.push(...airports));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < EUROPEAN_ICAO_PREFIXES.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Filter out closed airports and those without runways (unless heliports)
    const validAirports = allAirports.filter(
      airport => airport.type !== 'CLOSED' && 
                 (airport.runways.length > 0 || airport.type === 'HELIPORT')
    );
    
    // Cache the results
    allAirportsCache.airports = validAirports;
    allAirportsCache.fetchedAt = new Date();
    
    // Also cache individual airports
    validAirports.forEach(airport => {
      airportCache.set(airport.icao, {
        airport,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + AIRPORT_CACHE_DURATION),
      });
    });
    
    return validAirports;
  } catch (error) {
    console.error('Failed to fetch European airports:', error);
    return [];
  }
}

/**
 * Search airports with filters
 */
export async function searchAirports(filters: AirportSearchFilters): Promise<EnhancedAirport[]> {
  // Ensure airports are loaded
  let airports = allAirportsCache.airports;
  if (airports.length === 0) {
    airports = await fetchEuropeanAirports();
  }
  
  let results = [...airports];
  
  // Filter by query (ICAO, IATA, name, city)
  if (filters.query) {
    const query = filters.query.toUpperCase();
    results = results.filter(airport =>
      airport.icao.includes(query) ||
      airport.iata?.includes(query) ||
      airport.name.toUpperCase().includes(query) ||
      airport.city.toUpperCase().includes(query)
    );
  }
  
  // Filter by country
  if (filters.country) {
    results = results.filter(
      airport => airport.country.toLowerCase() === filters.country!.toLowerCase() ||
                 airport.countryCode.toLowerCase() === filters.country!.toLowerCase()
    );
  }
  
  // Filter by airport type
  if (filters.type && filters.type.length > 0) {
    results = results.filter(airport => filters.type!.includes(airport.type));
  }
  
  // Filter by minimum runway length
  if (filters.minRunwayLength) {
    results = results.filter(airport =>
      airport.runways.some(runway => runway.lengthMeters >= filters.minRunwayLength!)
    );
  }
  
  // Sort by relevance (larger airports first, then alphabetically)
  results.sort((a, b) => {
    const typeOrder = { LARGE_AIRPORT: 0, MEDIUM_AIRPORT: 1, SMALL_AIRPORT: 2, HELIPORT: 3, SEAPLANE_BASE: 4, CLOSED: 5 };
    const aOrder = typeOrder[a.type] ?? 5;
    const bOrder = typeOrder[b.type] ?? 5;
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.icao.localeCompare(b.icao);
  });
  
  // Limit results
  if (filters.maxResults) {
    results = results.slice(0, filters.maxResults);
  }
  
  return results;
}

/**
 * Fetch NOTAMs for an airport
 */
export async function fetchNotams(icao: string): Promise<Notam[]> {
  // Check cache
  const cached = notamCache.get(icao);
  if (cached && cached.expiresAt > new Date()) {
    return cached.notams;
  }
  
  try {
    const response = await icaoApi.get<{ notams: IcaoNotamResponse[] }>(`/notams/${icao.toUpperCase()}`);
    
    const notams = (response.data.notams || [])
      .map(parseNotam)
      .filter(notam => notam.effectiveTo > new Date()); // Only active NOTAMs
    
    // Cache the results
    notamCache.set(icao.toUpperCase(), {
      notams,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + NOTAM_CACHE_DURATION),
    });
    
    return notams;
  } catch (error) {
    console.error(`Failed to fetch NOTAMs for ${icao}:`, error);
    return [];
  }
}

/**
 * Fetch NOTAMs for multiple airports
 */
export async function fetchMultipleNotams(icaos: string[]): Promise<Record<string, Notam[]>> {
  const results: Record<string, Notam[]> = {};
  
  const promises = icaos.map(async (icao) => {
    const notams = await fetchNotams(icao);
    results[icao.toUpperCase()] = notams;
  });
  
  await Promise.all(promises);
  return results;
}

/**
 * Get cached airports (for quick access)
 */
export function getCachedAirports(): EnhancedAirport[] {
  return allAirportsCache.airports;
}

/**
 * Clear all caches
 */
export function clearIcaoCache(): void {
  airportCache.clear();
  notamCache.clear();
  allAirportsCache.airports = [];
  allAirportsCache.fetchedAt = null;
}

/**
 * Check if airports are loaded
 */
export function areAirportsLoaded(): boolean {
  return allAirportsCache.airports.length > 0;
}

/**
 * Get airport count
 */
export function getAirportCount(): number {
  return allAirportsCache.airports.length;
}
