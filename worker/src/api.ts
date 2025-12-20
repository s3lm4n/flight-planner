/**
 * Public API Handler
 * Handles /api/* routes
 * 
 * SECURITY: External API keys are stored as Cloudflare Worker secrets.
 * This worker injects API keys server-side to keep them out of frontend code.
 * 
 * Required secrets (set via `wrangler secret put <KEY_NAME>`):
 * - ADMIN_PASSWORD: Admin panel authentication
 * - ICAO_API_KEY: ICAO API for airport/runway data
 * - OPENAIP_CLIENT_ID: OpenAIP for airspace data
 * - WEATHER_API_KEY: Weather service (if needed)
 */

import { Env, STORAGE_KEYS, Airport, Notam } from './types';
import { validateApiKey } from './auth';
import { Storage } from './storage';

/**
 * Main API request handler
 */
export async function handleApiRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Health check - no auth required
  if (path === '/api/health') {
    return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
  }
  
  // AWC Weather proxy - no auth required (public weather data)
  if (path.startsWith('/api/awc/')) {
    return proxyAWCRequest(request, path);
  }
  
  // ICAO API proxy - injects API key server-side
  if (path.startsWith('/api/icao/')) {
    return proxyICAORequest(request, path, env);
  }
  
  // OpenAIP proxy - injects client ID server-side
  if (path.startsWith('/api/openaip/')) {
    return proxyOpenAIPRequest(request, path, env);
  }
  
  // Weather API proxy (metar-taf or other paid service)
  if (path.startsWith('/api/weather/')) {
    return proxyWeatherRequest(request, path, env);
  }
  
  // AirportDB proxy - https://airportdb.io
  if (path.startsWith('/api/airportdb/')) {
    return proxyAirportDBRequest(request, path, env);
  }
  
  // AviationStack proxy - https://aviationstack.com
  if (path.startsWith('/api/aviationstack/')) {
    return proxyAviationStackRequest(request, path, env);
  }
  
  // AirportGap proxy - https://airportgap.com
  if (path.startsWith('/api/airportgap/')) {
    return proxyAirportGapRequest(request, path, env);
  }
  
  // All other API routes require API key
  const authResult = await validateApiKey(request, env);
  if (!authResult.valid) {
    return jsonResponse({ error: authResult.error }, 401);
  }
  
  const storage = new Storage(env);
  
  // Route to specific handlers
  switch (true) {
    // Airports
    case path === '/api/airports' && request.method === 'GET':
      return getAirports(url, storage);
    
    case path.startsWith('/api/airports/') && request.method === 'GET':
      return getAirportByIcao(path, storage);
    
    // NOTAMs
    case path === '/api/notams' && request.method === 'GET':
      return getNotams(url, storage);
    
    // Search
    case path === '/api/search' && request.method === 'GET':
      return searchData(url, storage);
    
    // Route calculation
    case path === '/api/route' && request.method === 'POST':
      return calculateRoute(request, storage);
    
    default:
      return jsonResponse({ error: 'Not found' }, 404);
  }
}

/**
 * Proxy requests to AviationWeather.gov API
 * No API key required - public data
 */
async function proxyAWCRequest(request: Request, path: string): Promise<Response> {
  const AWC_BASE = 'https://aviationweather.gov/api/data';
  
  // Extract the AWC endpoint (metar, taf, etc.)
  const awcPath = path.replace('/api/awc/', '');
  const url = new URL(request.url);
  
  // Build the AWC URL with query params
  const awcUrl = new URL(`${AWC_BASE}/${awcPath}`);
  
  // Copy all query params
  url.searchParams.forEach((value, key) => {
    awcUrl.searchParams.set(key, value);
  });
  
  // Ensure JSON format
  if (!awcUrl.searchParams.has('format')) {
    awcUrl.searchParams.set('format', 'json');
  }
  
  try {
    const response = await fetch(awcUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightPlanner/1.0',
      },
    });
    
    if (!response.ok) {
      return jsonResponse({
        error: 'AWC request failed',
        status: response.status,
        statusText: response.statusText,
      }, response.status);
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from AviationWeather.gov',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Get airports with optional filtering
 * Query params: country, type, lat, lon, radius (nm)
 */
async function getAirports(url: URL, storage: Storage): Promise<Response> {
  const airports = await storage.get<Airport[]>(STORAGE_KEYS.AIRPORTS) || [];
  
  let filtered = [...airports];
  
  // Filter by country
  const country = url.searchParams.get('country');
  if (country) {
    filtered = filtered.filter(a => a.country.toLowerCase() === country.toLowerCase());
  }
  
  // Filter by type
  const type = url.searchParams.get('type');
  if (type) {
    filtered = filtered.filter(a => a.type?.toLowerCase() === type.toLowerCase());
  }
  
  // Filter by radius from point
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lon = parseFloat(url.searchParams.get('lon') || '');
  const radius = parseFloat(url.searchParams.get('radius') || '');
  
  if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
    filtered = filtered.filter(a => {
      const distance = calculateDistance(lat, lon, a.lat, a.lon);
      return distance <= radius;
    });
  }
  
  // Pagination
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  const paginated = filtered.slice(offset, offset + limit);
  
  return jsonResponse({
    success: true,
    data: paginated,
    total: filtered.length,
    limit,
    offset,
  });
}

/**
 * Get single airport by ICAO code
 */
async function getAirportByIcao(path: string, storage: Storage): Promise<Response> {
  const icao = path.split('/').pop()?.toUpperCase();
  
  if (!icao) {
    return jsonResponse({ error: 'ICAO code required' }, 400);
  }
  
  const airports = await storage.get<Airport[]>(STORAGE_KEYS.AIRPORTS) || [];
  const airport = airports.find(a => a.icao === icao);
  
  if (!airport) {
    return jsonResponse({ error: 'Airport not found' }, 404);
  }
  
  return jsonResponse({ success: true, data: airport });
}

/**
 * Get NOTAMs with optional filtering
 * Query params: icao, type, active
 */
async function getNotams(url: URL, storage: Storage): Promise<Response> {
  const notams = await storage.get<Notam[]>(STORAGE_KEYS.NOTAMS) || [];
  
  let filtered = [...notams];
  
  // Filter by ICAO
  const icao = url.searchParams.get('icao');
  if (icao) {
    filtered = filtered.filter(n => n.icao.toUpperCase() === icao.toUpperCase());
  }
  
  // Filter by type
  const type = url.searchParams.get('type');
  if (type) {
    filtered = filtered.filter(n => n.type.toLowerCase() === type.toLowerCase());
  }
  
  // Filter active only
  const activeOnly = url.searchParams.get('active') === 'true';
  if (activeOnly) {
    const now = new Date().toISOString();
    filtered = filtered.filter(n => {
      const isStarted = n.effectiveFrom <= now;
      const isNotExpired = !n.effectiveTo || n.effectiveTo >= now;
      return isStarted && isNotExpired;
    });
  }
  
  // Pagination
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  const paginated = filtered.slice(offset, offset + limit);
  
  return jsonResponse({
    success: true,
    data: paginated,
    total: filtered.length,
    limit,
    offset,
  });
}

/**
 * Search airports and NOTAMs
 * Query params: q (search term), type (airports, notams, all)
 */
async function searchData(url: URL, storage: Storage): Promise<Response> {
  const query = url.searchParams.get('q')?.toLowerCase();
  const searchType = url.searchParams.get('type') || 'all';
  
  if (!query) {
    return jsonResponse({ error: 'Search query required' }, 400);
  }
  
  const results: { airports?: Airport[]; notams?: Notam[] } = {};
  
  // Search airports
  if (searchType === 'all' || searchType === 'airports') {
    const airports = await storage.get<Airport[]>(STORAGE_KEYS.AIRPORTS) || [];
    results.airports = airports.filter(a => 
      a.icao.toLowerCase().includes(query) ||
      a.iata?.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query) ||
      a.city?.toLowerCase().includes(query)
    ).slice(0, 50);
  }
  
  // Search NOTAMs
  if (searchType === 'all' || searchType === 'notams') {
    const notams = await storage.get<Notam[]>(STORAGE_KEYS.NOTAMS) || [];
    results.notams = notams.filter(n =>
      n.icao.toLowerCase().includes(query) ||
      n.text.toLowerCase().includes(query)
    ).slice(0, 50);
  }
  
  return jsonResponse({ success: true, data: results });
}

/**
 * Calculate route between airports
 */
async function calculateRoute(request: Request, storage: Storage): Promise<Response> {
  try {
    const body = await request.json() as {
      departure: string;
      arrival: string;
      waypoints?: string[];
    };
    
    const { departure, arrival, waypoints = [] } = body;
    
    if (!departure || !arrival) {
      return jsonResponse({ error: 'Departure and arrival ICAO codes required' }, 400);
    }
    
    const airports = await storage.get<Airport[]>(STORAGE_KEYS.AIRPORTS) || [];
    
    // Find airports
    const findAirport = (icao: string) => airports.find(a => a.icao.toUpperCase() === icao.toUpperCase());
    
    const depAirport = findAirport(departure);
    const arrAirport = findAirport(arrival);
    
    if (!depAirport) {
      return jsonResponse({ error: `Departure airport not found: ${departure}` }, 404);
    }
    
    if (!arrAirport) {
      return jsonResponse({ error: `Arrival airport not found: ${arrival}` }, 404);
    }
    
    // Find waypoint airports
    const waypointAirports = waypoints.map(wp => {
      const apt = findAirport(wp);
      if (!apt) throw new Error(`Waypoint not found: ${wp}`);
      return apt;
    });
    
    // Build route
    const routePoints = [depAirport, ...waypointAirports, arrAirport];
    
    // Calculate legs
    const legs = [];
    let totalDistance = 0;
    
    for (let i = 0; i < routePoints.length - 1; i++) {
      const from = routePoints[i];
      const to = routePoints[i + 1];
      const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
      const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);
      
      totalDistance += distance;
      
      legs.push({
        from: from.icao,
        to: to.icao,
        distance: Math.round(distance * 10) / 10,
        bearing: Math.round(bearing),
      });
    }
    
    return jsonResponse({
      success: true,
      data: {
        departure: depAirport,
        arrival: arrAirport,
        waypoints: waypointAirports,
        legs,
        totalDistance: Math.round(totalDistance * 10) / 10,
        routeString: routePoints.map(p => p.icao).join(' → '),
      }
    });
    
  } catch (error) {
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Route calculation failed' 
    }, 400);
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in nautical miles
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Calculate bearing between two coordinates
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * JSON response helper
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// EXTERNAL API PROXIES - Server-side API key injection
// ============================================================================

/**
 * Proxy requests to ICAO API
 * Injects ICAO_API_KEY from Worker secrets
 * 
 * Frontend calls: /api/icao/airports?icao=KJFK
 * Proxied to: https://api.icao.org/... with API key header
 */
async function proxyICAORequest(request: Request, path: string, env: Env): Promise<Response> {
  if (!env.ICAO_API_KEY) {
    return jsonResponse({
      error: 'ICAO API not configured',
      message: 'ICAO_API_KEY secret is not set. Run: wrangler secret put ICAO_API_KEY',
    }, 503);
  }

  const ICAO_API_BASE = 'https://applications.icao.int/dataservices/api';
  
  // Extract the ICAO endpoint
  const icaoPath = path.replace('/api/icao/', '');
  const url = new URL(request.url);
  
  // Build the ICAO URL
  const icaoUrl = new URL(`${ICAO_API_BASE}/${icaoPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    icaoUrl.searchParams.set(key, value);
  });
  
  // Add API key
  icaoUrl.searchParams.set('api_key', env.ICAO_API_KEY);
  icaoUrl.searchParams.set('format', 'json');

  try {
    const response = await fetch(icaoUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightPlanner/1.0',
      },
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'ICAO API request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from ICAO API',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Proxy requests to OpenAIP
 * Injects OPENAIP_CLIENT_ID from Worker secrets
 */
async function proxyOpenAIPRequest(request: Request, path: string, env: Env): Promise<Response> {
  if (!env.OPENAIP_CLIENT_ID) {
    return jsonResponse({
      error: 'OpenAIP API not configured',
      message: 'OPENAIP_CLIENT_ID secret is not set. Run: wrangler secret put OPENAIP_CLIENT_ID',
    }, 503);
  }

  const OPENAIP_BASE = 'https://api.core.openaip.net/api';
  
  // Extract the OpenAIP endpoint
  const openaipPath = path.replace('/api/openaip/', '');
  const url = new URL(request.url);
  
  // Build the OpenAIP URL
  const openaipUrl = new URL(`${OPENAIP_BASE}/${openaipPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    openaipUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(openaipUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-openaip-client-id': env.OPENAIP_CLIENT_ID,
        'User-Agent': 'FlightPlanner/1.0',
      },
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'OpenAIP request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from OpenAIP',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Proxy requests to Weather API (metar-taf.com or similar)
 * Injects WEATHER_API_KEY from Worker secrets
 */
async function proxyWeatherRequest(request: Request, path: string, env: Env): Promise<Response> {
  // Weather API is optional - return 503 if not configured
  if (!env.WEATHER_API_KEY) {
    return jsonResponse({
      error: 'Weather API not configured',
      message: 'WEATHER_API_KEY secret is not set. Use /api/awc for free weather data.',
    }, 503);
  }

  const WEATHER_BASE = 'https://api.metar-taf.com';
  
  // Extract the weather endpoint
  const weatherPath = path.replace('/api/weather/', '');
  const url = new URL(request.url);
  
  // Build the Weather URL
  const weatherUrl = new URL(`${WEATHER_BASE}/${weatherPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    weatherUrl.searchParams.set(key, value);
  });
  
  // Add API key
  weatherUrl.searchParams.set('api_key', env.WEATHER_API_KEY);

  try {
    const response = await fetch(weatherUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightPlanner/1.0',
      },
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'Weather API request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch weather data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Proxy requests to AirportDB API
 * https://airportdb.io
 * Injects AIRPORTDB_API_KEY from Worker secrets
 */
async function proxyAirportDBRequest(request: Request, path: string, env: Env): Promise<Response> {
  if (!env.AIRPORTDB_API_KEY) {
    return jsonResponse({
      error: 'AirportDB API not configured',
      message: 'AIRPORTDB_API_KEY secret is not set. Run: wrangler secret put AIRPORTDB_API_KEY',
    }, 503);
  }

  const AIRPORTDB_BASE = 'https://airportdb.io/api/v1';
  
  // Extract the endpoint
  const apiPath = path.replace('/api/airportdb/', '');
  const url = new URL(request.url);
  
  // Build the AirportDB URL
  const targetUrl = new URL(`${AIRPORTDB_BASE}/${apiPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': env.AIRPORTDB_API_KEY,
        'User-Agent': 'FlightPlanner/1.0',
      },
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'AirportDB request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from AirportDB',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Proxy requests to AviationStack API
 * https://aviationstack.com
 * Injects AVIATIONSTACK_API_KEY from Worker secrets
 */
async function proxyAviationStackRequest(request: Request, path: string, env: Env): Promise<Response> {
  if (!env.AVIATIONSTACK_API_KEY) {
    return jsonResponse({
      error: 'AviationStack API not configured',
      message: 'AVIATIONSTACK_API_KEY secret is not set. Run: wrangler secret put AVIATIONSTACK_API_KEY',
    }, 503);
  }

  const AVIATIONSTACK_BASE = 'https://api.aviationstack.com/v1';
  
  // Extract the endpoint
  const apiPath = path.replace('/api/aviationstack/', '');
  const url = new URL(request.url);
  
  // Build the AviationStack URL
  const targetUrl = new URL(`${AVIATIONSTACK_BASE}/${apiPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });
  
  // Add API key as query param (AviationStack uses access_key)
  targetUrl.searchParams.set('access_key', env.AVIATIONSTACK_API_KEY);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightPlanner/1.0',
      },
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'AviationStack request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from AviationStack',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}

/**
 * Proxy requests to AirportGap API
 * https://airportgap.com
 * Injects AIRPORTGAP_API_KEY from Worker secrets
 */
async function proxyAirportGapRequest(request: Request, path: string, env: Env): Promise<Response> {
  if (!env.AIRPORTGAP_API_KEY) {
    return jsonResponse({
      error: 'AirportGap API not configured',
      message: 'AIRPORTGAP_API_KEY secret is not set. Run: wrangler secret put AIRPORTGAP_API_KEY',
    }, 503);
  }

  const AIRPORTGAP_BASE = 'https://airportgap.com/api';
  
  // Extract the endpoint
  const apiPath = path.replace('/api/airportgap/', '');
  const url = new URL(request.url);
  
  // Build the AirportGap URL
  const targetUrl = new URL(`${AIRPORTGAP_BASE}/${apiPath}`);
  
  // Copy query params
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${env.AIRPORTGAP_API_KEY}`,
        'User-Agent': 'FlightPlanner/1.0',
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    if (!response.ok) {
      return jsonResponse({
        error: 'AirportGap request failed',
        status: response.status,
      }, response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to fetch from AirportGap',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 502);
  }
}
