/**
 * Aviation API Client
 * 
 * This client communicates with the Cloudflare Worker proxy.
 * It NEVER calls external APIs directly.
 * 
 * CONFIGURATION:
 * ==============
 * Set VITE_WORKER_URL in your .env file:
 * VITE_WORKER_URL=https://flight-planner-api.YOUR-SUBDOMAIN.workers.dev
 * 
 * For local development with wrangler dev:
 * VITE_WORKER_URL=http://localhost:8787
 */

// Worker URL from environment or fallback for development
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

// ============================================================================
// TYPES
// ============================================================================

export interface MetarResponse {
  success: boolean;
  data: MetarData;
  raw: string | null;
  timestamp: string;
  error?: string;
}

export interface MetarData {
  icaoId: string;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number | string;
  wspd: number;
  wgst?: number;
  visib: number | string;
  altim: number;
  slp?: number;
  qnh?: number;
  wxString?: string;
  clouds?: CloudLayer[];
  rawOb: string;
  lat: number;
  lon: number;
  elev: number;
  name?: string;
}

export interface CloudLayer {
  cover: string;
  base: number;
}

export interface TafResponse {
  success: boolean;
  data: TafData;
  raw: string | null;
  timestamp: string;
  error?: string;
}

export interface TafData {
  icaoId: string;
  rawTAF: string;
  issueTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  lat: number;
  lon: number;
  elev: number;
}

export interface OpenAIPAirport {
  _id: string;
  name: string;
  icaoCode: string;
  iataCode?: string;
  country: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
  elevation: {
    value: number;
    unit: string;
  };
  type: number;
  runways?: OpenAIPRunway[];
  frequencies?: OpenAIPFrequency[];
}

export interface OpenAIPRunway {
  _id: string;
  designator: string;
  trueHeading: number;
  alignedTrueNorth?: boolean;
  operations?: number;
  mainRunway?: boolean;
  dimension: {
    length: {
      value: number;
      unit: string;
    };
    width: {
      value: number;
      unit: string;
    };
  };
  surface: {
    mainComposite: number;
    composition?: number[];
  };
  thresholdElevation?: {
    value: number;
    unit: string;
  };
  thresholdLocation?: {
    type: string;
    coordinates: [number, number];
  };
  ilsAvailable?: boolean;
  pilotCtrlLighting?: boolean;
}

export interface OpenAIPFrequency {
  _id: string;
  value: number;
  unit: string;
  type: number;
  name: string;
  primary?: boolean;
}

export interface OpenAIPNavaid {
  _id: string;
  name: string;
  identifier: string;
  type: number;
  frequency?: {
    value: number;
    unit: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  elevation?: {
    value: number;
    unit: string;
  };
}

export interface APIError {
  error: string;
  success: false;
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class AviationAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = WORKER_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic fetch with error handling
   */
  private async fetchAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error - unable to reach API');
    }
  }

  /**
   * Fetch METAR for an airport
   * @param icao - 4-letter ICAO code
   */
  async getMetar(icao: string): Promise<MetarResponse> {
    if (!icao || icao.length !== 4) {
      throw new Error('Invalid ICAO code');
    }
    return this.fetchAPI<MetarResponse>('/api/metar', { icao: icao.toUpperCase() });
  }

  /**
   * Fetch TAF for an airport
   * @param icao - 4-letter ICAO code
   */
  async getTaf(icao: string): Promise<TafResponse> {
    if (!icao || icao.length !== 4) {
      throw new Error('Invalid ICAO code');
    }
    return this.fetchAPI<TafResponse>('/api/taf', { icao: icao.toUpperCase() });
  }

  /**
   * Search airports by ICAO code
   */
  async getAirportByIcao(icao: string): Promise<{ success: boolean; data: { items: OpenAIPAirport[] } }> {
    if (!icao || icao.length !== 4) {
      throw new Error('Invalid ICAO code');
    }
    return this.fetchAPI('/api/openaip/airports', { icao: icao.toUpperCase() });
  }

  /**
   * Search airports by coordinates (bounding box)
   */
  async searchAirportsInArea(
    minLat: number, 
    maxLat: number, 
    minLon: number, 
    maxLon: number,
    limit: number = 50
  ): Promise<{ success: boolean; data: { items: OpenAIPAirport[] } }> {
    return this.fetchAPI('/api/openaip/airports', {
      'pos': `${(minLat + maxLat) / 2},${(minLon + maxLon) / 2}`,
      'dist': '100000', // 100km radius
      'limit': limit.toString(),
    });
  }

  /**
   * Get airport details by openAIP ID
   */
  async getAirportById(id: string): Promise<{ success: boolean; data: OpenAIPAirport }> {
    return this.fetchAPI(`/api/openaip/airport/${id}`);
  }

  /**
   * Get runways for an airport
   */
  async getRunways(airportId: string): Promise<{ success: boolean; data: { items: OpenAIPRunway[] } }> {
    return this.fetchAPI('/api/openaip/runways', { airportId });
  }

  /**
   * Search navaids by position
   */
  async searchNavaids(
    lat: number, 
    lon: number, 
    radiusKm: number = 200
  ): Promise<{ success: boolean; data: { items: OpenAIPNavaid[] } }> {
    return this.fetchAPI('/api/openaip/navaids', {
      'pos': `${lat},${lon}`,
      'dist': (radiusKm * 1000).toString(),
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ success: boolean; status: string }> {
    return this.fetchAPI('/api/health');
  }
}

// Export singleton instance
export const aviationAPI = new AviationAPIClient();

// Export class for custom instances
export { AviationAPIClient };

// ============================================================================
// HELPER FUNCTIONS FOR WEATHER DECODING
// ============================================================================

/**
 * Decode wind information from METAR
 */
export function decodeWind(metar: MetarData): {
  direction: number | 'VRB';
  speed: number;
  gust: number | null;
  isVariable: boolean;
} {
  return {
    direction: metar.wdir === 'VRB' ? 'VRB' : Number(metar.wdir),
    speed: metar.wspd,
    gust: metar.wgst || null,
    isVariable: metar.wdir === 'VRB',
  };
}

/**
 * Calculate wind components relative to runway
 * @param windDir - Wind direction in degrees
 * @param windSpeed - Wind speed in knots
 * @param runwayHeading - Runway heading in degrees
 */
export function calculateWindComponents(
  windDir: number | 'VRB',
  windSpeed: number,
  runwayHeading: number
): { headwind: number; crosswind: number } {
  // Variable wind - assume worst case
  if (windDir === 'VRB') {
    return {
      headwind: 0,
      crosswind: windSpeed, // Worst case
    };
  }

  // Calculate relative angle
  const relativeAngle = ((windDir - runwayHeading + 360) % 360) * (Math.PI / 180);
  
  // Headwind is positive when wind is from ahead
  // Negative headwind = tailwind
  const headwind = Math.round(windSpeed * Math.cos(relativeAngle));
  const crosswind = Math.round(Math.abs(windSpeed * Math.sin(relativeAngle)));

  return { headwind, crosswind };
}

/**
 * Get visibility in statute miles
 */
export function getVisibilityMiles(metar: MetarData): number {
  if (typeof metar.visib === 'number') {
    return metar.visib;
  }
  // Parse string visibility (e.g., "10+")
  const vis = parseFloat(String(metar.visib).replace('+', ''));
  return isNaN(vis) ? 10 : vis;
}

/**
 * Get ceiling in feet (lowest BKN or OVC layer)
 */
export function getCeilingFeet(metar: MetarData): number | null {
  if (!metar.clouds || metar.clouds.length === 0) {
    return null; // Clear or no data
  }

  const ceilingLayers = metar.clouds.filter(
    c => c.cover === 'BKN' || c.cover === 'OVC'
  );

  if (ceilingLayers.length === 0) {
    return null; // No ceiling
  }

  // Return lowest ceiling
  return Math.min(...ceilingLayers.map(c => c.base * 100)); // AGL in feet
}

/**
 * Determine flight category from METAR
 */
export function getFlightCategory(metar: MetarData): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  const visibility = getVisibilityMiles(metar);
  const ceiling = getCeilingFeet(metar);

  // LIFR: Ceiling < 500ft or Visibility < 1 SM
  if ((ceiling !== null && ceiling < 500) || visibility < 1) {
    return 'LIFR';
  }

  // IFR: Ceiling 500-999ft or Visibility 1-3 SM
  if ((ceiling !== null && ceiling < 1000) || visibility < 3) {
    return 'IFR';
  }

  // MVFR: Ceiling 1000-3000ft or Visibility 3-5 SM
  if ((ceiling !== null && ceiling <= 3000) || visibility <= 5) {
    return 'MVFR';
  }

  return 'VFR';
}
