export interface Env {
  DATA_KV: KVNamespace;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  
  // === REQUIRED SECRETS ===
  // Set these using: wrangler secret put <KEY_NAME>
  
  /** Admin panel password */
  ADMIN_PASSWORD?: string;
  
  /** Internal API authentication key */
  API_SECRET_KEY?: string;
  
  /** ICAO API key for airport/runway data */
  ICAO_API_KEY?: string;
  
  /** OpenAIP client ID for airspace data */
  OPENAIP_CLIENT_ID?: string;
  
  /** Weather API key (if using paid weather service) */
  WEATHER_API_KEY?: string;
  
  /** AirportDB API key - https://airportdb.io */
  AIRPORTDB_API_KEY?: string;
  
  /** AviationStack API key - https://aviationstack.com */
  AVIATIONSTACK_API_KEY?: string;
  
  /** AirportGap API token - https://airportgap.com */
  AIRPORTGAP_API_KEY?: string;
}

export const STORAGE_KEYS = {
  AIRPORTS: 'data:airports',
  ICAO_CODES: 'data:icao',
  NOTAMS: 'data:notams',
  API_KEYS: 'config:api_keys',
  ADMIN_SESSIONS: 'sessions:admin',
} as const;

// API key structure
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
  permissions: string[];
  active: boolean;
}

// Airport data structure
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

// NOTAM structure
export interface Notam {
  id: string;
  icao: string;
  text: string;
  effectiveFrom: string;
  effectiveTo?: string;
  type: string;
}

// CSV parse result
export interface ParseResult<T> {
  success: boolean;
  data?: T[];
  errors?: string[];
  rowCount?: number;
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Admin session
export interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}
