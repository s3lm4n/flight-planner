/**
 * Public API Handler
 * Handles /api/* routes - requires valid API key
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
