/**
 * Cloudflare Worker - Aviation API Proxy
 * 
 * This worker proxies requests to:
 * - aviationweather.gov (METAR/TAF)
 * - openAIP (airports, runways, navaids)
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * ========================
 * 1. Install Wrangler CLI: npm install -g wrangler
 * 2. Login to Cloudflare: wrangler login
 * 3. Create the worker: wrangler init flight-planner-api
 * 4. Copy this file to the worker directory
 * 5. Add your openAIP API key as a secret:
 *    wrangler secret put OPENAIP_KEY
 *    (Enter your openAIP API key when prompted)
 * 6. Deploy: wrangler deploy
 * 
 * REQUIRED SECRETS:
 * =================
 * - OPENAIP_KEY: Your openAIP API key from https://www.openaip.net
 * 
 * ENDPOINTS:
 * ==========
 * GET /api/metar?icao=XXXX     - Fetch METAR data
 * GET /api/taf?icao=XXXX       - Fetch TAF data
 * GET /api/openaip/airports    - Search airports
 * GET /api/openaip/airport/:id - Get airport details
 * GET /api/openaip/runways     - Get runway data
 * GET /api/openaip/navaids     - Get navaid data
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper to create JSON response with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper to create error response
function errorResponse(message, status = 500) {
  return jsonResponse({ error: message, success: false }, status);
}

// Handle CORS preflight
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Fetch METAR data from aviationweather.gov
 * @param {string} icao - ICAO airport code
 */
async function fetchMetar(icao) {
  if (!icao || icao.length !== 4) {
    throw new Error('Invalid ICAO code. Must be exactly 4 characters.');
  }

  const url = `https://aviationweather.gov/api/data/metar?ids=${icao.toUpperCase()}&format=json`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlightPlanner/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Aviation Weather API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error(`No METAR data available for ${icao}`);
  }

  return {
    success: true,
    data: data[0],
    raw: data[0]?.rawOb || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fetch TAF data from aviationweather.gov
 * @param {string} icao - ICAO airport code
 */
async function fetchTaf(icao) {
  if (!icao || icao.length !== 4) {
    throw new Error('Invalid ICAO code. Must be exactly 4 characters.');
  }

  const url = `https://aviationweather.gov/api/data/taf?ids=${icao.toUpperCase()}&format=json`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlightPlanner/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Aviation Weather API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error(`No TAF data available for ${icao}`);
  }

  return {
    success: true,
    data: data[0],
    raw: data[0]?.rawTAF || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Proxy requests to openAIP API
 * @param {string} path - API path after /api/openaip/
 * @param {URLSearchParams} params - Query parameters
 * @param {string} apiKey - openAIP API key from environment
 */
async function fetchOpenAIP(path, params, apiKey) {
  if (!apiKey) {
    throw new Error('openAIP API key not configured. Add OPENAIP_KEY secret to worker.');
  }

  // Build the openAIP API URL
  const baseUrl = 'https://api.core.openaip.net/api';
  const url = new URL(`${baseUrl}/${path}`);
  
  // Add query parameters
  for (const [key, value] of params.entries()) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-openaip-client-id': apiKey,
      'Accept': 'application/json',
      'User-Agent': 'FlightPlanner/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`openAIP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Search airports by various criteria
 */
async function searchAirports(params, apiKey) {
  // openAIP airports endpoint
  return fetchOpenAIP('airports', params, apiKey);
}

/**
 * Get airport by ID
 */
async function getAirportById(id, apiKey) {
  const params = new URLSearchParams();
  return fetchOpenAIP(`airports/${id}`, params, apiKey);
}

/**
 * Search airports by ICAO code
 */
async function getAirportByIcao(icao, apiKey) {
  const params = new URLSearchParams();
  params.append('search', icao.toUpperCase());
  params.append('searchBy', 'icaoCode');
  params.append('limit', '1');
  return fetchOpenAIP('airports', params, apiKey);
}

/**
 * Get runways for an airport
 */
async function getRunways(airportId, apiKey) {
  const params = new URLSearchParams();
  params.append('airportId', airportId);
  return fetchOpenAIP('runways', params, apiKey);
}

/**
 * Search navaids (VOR, NDB, etc.)
 */
async function searchNavaids(params, apiKey) {
  return fetchOpenAIP('navaids', params, apiKey);
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    try {
      // ========================================
      // METAR endpoint
      // ========================================
      if (path === '/api/metar') {
        const icao = params.get('icao');
        if (!icao) {
          return errorResponse('Missing icao parameter', 400);
        }
        const result = await fetchMetar(icao);
        return jsonResponse(result);
      }

      // ========================================
      // TAF endpoint
      // ========================================
      if (path === '/api/taf') {
        const icao = params.get('icao');
        if (!icao) {
          return errorResponse('Missing icao parameter', 400);
        }
        const result = await fetchTaf(icao);
        return jsonResponse(result);
      }

      // ========================================
      // openAIP - Search airports
      // ========================================
      if (path === '/api/openaip/airports') {
        // Check for ICAO search
        const icao = params.get('icao');
        if (icao) {
          const result = await getAirportByIcao(icao, env.OPENAIP_KEY);
          return jsonResponse(result);
        }
        
        // General search
        const result = await searchAirports(params, env.OPENAIP_KEY);
        return jsonResponse(result);
      }

      // ========================================
      // openAIP - Get airport by ID
      // ========================================
      if (path.startsWith('/api/openaip/airport/')) {
        const id = path.replace('/api/openaip/airport/', '');
        if (!id) {
          return errorResponse('Missing airport ID', 400);
        }
        const result = await getAirportById(id, env.OPENAIP_KEY);
        return jsonResponse(result);
      }

      // ========================================
      // openAIP - Runways
      // ========================================
      if (path === '/api/openaip/runways') {
        const airportId = params.get('airportId');
        if (!airportId) {
          return errorResponse('Missing airportId parameter', 400);
        }
        const result = await getRunways(airportId, env.OPENAIP_KEY);
        return jsonResponse(result);
      }

      // ========================================
      // openAIP - Navaids
      // ========================================
      if (path === '/api/openaip/navaids') {
        const result = await searchNavaids(params, env.OPENAIP_KEY);
        return jsonResponse(result);
      }

      // ========================================
      // Health check
      // ========================================
      if (path === '/api/health') {
        return jsonResponse({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          endpoints: [
            '/api/metar?icao=XXXX',
            '/api/taf?icao=XXXX',
            '/api/openaip/airports',
            '/api/openaip/airports?icao=XXXX',
            '/api/openaip/airport/:id',
            '/api/openaip/runways?airportId=XXX',
            '/api/openaip/navaids',
          ],
        });
      }

      // ========================================
      // Not found
      // ========================================
      return errorResponse('Endpoint not found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(error.message || 'Internal server error', 500);
    }
  },
};
