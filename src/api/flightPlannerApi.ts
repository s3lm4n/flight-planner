/**
 * Public API Client
 * Requires valid API key for all requests
 */

export interface FlightPlannerApiConfig {
  baseUrl?: string;
  apiKey: string;
}

export interface Airport {
  icao: string;
  iata?: string;
  name: string;
  city?: string;
  country: string;
  lat: number;
  lon: number;
  elevation?: number;
  type?: string;
}

export interface Notam {
  id: string;
  icao: string;
  text: string;
  effectiveFrom: string;
  effectiveTo?: string;
  type: string;
}

export interface Route {
  departure: Airport;
  arrival: Airport;
  waypoints: Airport[];
  legs: Array<{
    from: string;
    to: string;
    distance: number;
    bearing: number;
  }>;
  totalDistance: number;
  routeString: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

class FlightPlannerApi {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(config?: Partial<FlightPlannerApiConfig>) {
    this.baseUrl = config?.baseUrl || '/api';
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    }
  }

  /**
   * Set API key
   */
  setApiKey(key: string) {
    this.apiKey = key;
  }

  /**
   * Set base URL
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API key not set. Call setApiKey() first.');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...(options.headers || {}),
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  /**
   * Health check (no auth required)
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * Get airports
   */
  async getAirports(params?: {
    country?: string;
    type?: string;
    lat?: number;
    lon?: number;
    radius?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Airport>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/airports${query ? `?${query}` : ''}`);
  }

  /**
   * Get airport by ICAO code
   */
  async getAirport(icao: string): Promise<{ success: boolean; data: Airport }> {
    return this.request(`/airports/${icao.toUpperCase()}`);
  }

  /**
   * Get NOTAMs
   */
  async getNotams(params?: {
    icao?: string;
    type?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Notam>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/notams${query ? `?${query}` : ''}`);
  }

  /**
   * Search airports and NOTAMs
   */
  async search(query: string, type?: 'airports' | 'notams' | 'all'): Promise<{
    success: boolean;
    data: {
      airports?: Airport[];
      notams?: Notam[];
    };
  }> {
    const searchParams = new URLSearchParams({ q: query });
    if (type) {
      searchParams.set('type', type);
    }
    return this.request(`/search?${searchParams}`);
  }

  /**
   * Calculate route between airports
   */
  async calculateRoute(params: {
    departure: string;
    arrival: string;
    waypoints?: string[];
  }): Promise<{ success: boolean; data: Route }> {
    return this.request('/route', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Find airports near a point
   */
  async findNearby(
    lat: number,
    lon: number,
    radiusNm: number = 50
  ): Promise<PaginatedResponse<Airport>> {
    return this.getAirports({ lat, lon, radius: radiusNm });
  }
}

// Singleton instance
export const flightPlannerApi = new FlightPlannerApi();

// Also export class for custom instances
export { FlightPlannerApi };
