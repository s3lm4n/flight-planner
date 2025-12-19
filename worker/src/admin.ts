/**
 * Admin Request Handler
 * Handles /admin/* routes with authentication
 */

import { Env, ApiKey, STORAGE_KEYS, ApiResponse } from './types';
import { validateAdminAuth, createAdminSession, generateApiKey, unauthorizedResponse } from './auth';
import { Storage } from './storage';
import { parseAirportsCSV, parseNotamsCSV, detectCSVType } from './csv-parser';

/**
 * Main admin request handler
 */
export async function handleAdminRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Admin login endpoint - no auth required
  if (path === '/admin/api/login' && request.method === 'POST') {
    return handleAdminLogin(request, env);
  }
  
  // All other admin routes require authentication
  const authResult = await validateAdminAuth(request, env);
  if (!authResult.valid) {
    // If requesting admin panel HTML, redirect to login
    if (path === '/admin' || path === '/admin/') {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', request.url)));
    }
    return unauthorizedResponse(authResult.error);
  }
  
  // Admin API routes
  if (path.startsWith('/admin/api/')) {
    return handleAdminApi(request, env, path);
  }
  
  // Serve admin panel static files
  const assetPath = path === '/admin' || path === '/admin/' 
    ? '/admin/index.html' 
    : path;
  return env.ASSETS.fetch(new Request(new URL(assetPath, request.url)));
}

/**
 * Admin login handler
 */
async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.ADMIN_PASSWORD) {
      return jsonResponse({ success: false, error: 'Admin password not configured' }, 500);
    }
    
    const body = await request.json() as { password?: string };
    
    if (body.password !== env.ADMIN_PASSWORD) {
      return jsonResponse({ success: false, error: 'Invalid password' }, 401);
    }
    
    const session = await createAdminSession(env);
    
    return jsonResponse({
      success: true,
      data: { token: session.token, expiresAt: session.expiresAt }
    });
  } catch (error) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400);
  }
}

/**
 * Admin API router
 */
async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const storage = new Storage(env);
  
  // Upload CSV
  if (path === '/admin/api/upload' && method === 'POST') {
    return handleCSVUpload(request, storage);
  }
  
  // API Keys management
  if (path === '/admin/api/keys') {
    if (method === 'GET') return getApiKeys(storage);
    if (method === 'POST') return createApiKey(request, storage);
  }
  
  if (path.startsWith('/admin/api/keys/') && method === 'DELETE') {
    const keyId = path.split('/').pop();
    return deleteApiKey(keyId!, storage);
  }
  
  // Data management
  if (path === '/admin/api/airports' && method === 'GET') {
    return getData(STORAGE_KEYS.AIRPORTS, storage);
  }
  
  if (path === '/admin/api/notams' && method === 'GET') {
    return getData(STORAGE_KEYS.NOTAMS, storage);
  }
  
  if (path === '/admin/api/stats' && method === 'GET') {
    return getStats(storage);
  }
  
  // Clear data
  if (path === '/admin/api/clear' && method === 'POST') {
    return clearData(request, storage);
  }
  
  return jsonResponse({ error: 'Not found' }, 404);
}

/**
 * Handle CSV file upload
 */
async function handleCSVUpload(request: Request, storage: Storage): Promise<Response> {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    let csvContent: string;
    let dataType: string | null = null;
    
    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      dataType = formData.get('type') as string | null;
      
      if (!file) {
        return jsonResponse({ success: false, error: 'No file uploaded' }, 400);
      }
      
      csvContent = await file.text();
    } 
    // Handle raw CSV
    else {
      csvContent = await request.text();
      dataType = new URL(request.url).searchParams.get('type');
    }
    
    // Auto-detect type if not specified
    if (!dataType) {
      dataType = detectCSVType(csvContent);
    }
    
    // Parse based on type
    let result;
    let storageKey: string;
    
    switch (dataType) {
      case 'airports':
        result = parseAirportsCSV(csvContent);
        storageKey = STORAGE_KEYS.AIRPORTS;
        break;
      case 'notams':
        result = parseNotamsCSV(csvContent);
        storageKey = STORAGE_KEYS.NOTAMS;
        break;
      default:
        return jsonResponse({ 
          success: false, 
          error: `Unknown data type: ${dataType}. Specify type=airports or type=notams` 
        }, 400);
    }
    
    if (!result.success) {
      return jsonResponse({ success: false, errors: result.errors }, 400);
    }
    
    // Store parsed data
    await storage.set(storageKey, result.data);
    
    return jsonResponse({
      success: true,
      message: `Successfully imported ${result.rowCount} ${dataType}`,
      rowCount: result.rowCount,
      errors: result.errors,
    });
    
  } catch (error) {
    return jsonResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, 500);
  }
}

/**
 * Get API keys (masked)
 */
async function getApiKeys(storage: Storage): Promise<Response> {
  const keys = await storage.get<ApiKey[]>(STORAGE_KEYS.API_KEYS) || [];
  
  // Mask API keys for display
  const maskedKeys = keys.map(k => ({
    ...k,
    key: `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`,
  }));
  
  return jsonResponse({ success: true, data: maskedKeys });
}

/**
 * Create new API key
 */
async function createApiKey(request: Request, storage: Storage): Promise<Response> {
  try {
    const body = await request.json() as { name?: string; permissions?: string[] };
    
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      key: generateApiKey(),
      name: body.name || 'Unnamed Key',
      createdAt: new Date().toISOString(),
      permissions: body.permissions || ['read'],
      active: true,
    };
    
    const keys = await storage.get<ApiKey[]>(STORAGE_KEYS.API_KEYS) || [];
    keys.push(newKey);
    await storage.set(STORAGE_KEYS.API_KEYS, keys);
    
    // Return full key only on creation
    return jsonResponse({ success: true, data: newKey });
    
  } catch (error) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400);
  }
}

/**
 * Delete API key
 */
async function deleteApiKey(keyId: string, storage: Storage): Promise<Response> {
  const keys = await storage.get<ApiKey[]>(STORAGE_KEYS.API_KEYS) || [];
  const filtered = keys.filter(k => k.id !== keyId);
  
  if (filtered.length === keys.length) {
    return jsonResponse({ success: false, error: 'Key not found' }, 404);
  }
  
  await storage.set(STORAGE_KEYS.API_KEYS, filtered);
  return jsonResponse({ success: true, message: 'Key deleted' });
}

/**
 * Get stored data
 */
async function getData(key: string, storage: Storage): Promise<Response> {
  const data = await storage.get(key) || [];
  return jsonResponse({ success: true, data });
}

/**
 * Get admin dashboard stats
 */
async function getStats(storage: Storage): Promise<Response> {
  const airports = await storage.get<unknown[]>(STORAGE_KEYS.AIRPORTS) || [];
  const notams = await storage.get<unknown[]>(STORAGE_KEYS.NOTAMS) || [];
  const apiKeys = await storage.get<ApiKey[]>(STORAGE_KEYS.API_KEYS) || [];
  
  return jsonResponse({
    success: true,
    data: {
      airports: airports.length,
      notams: notams.length,
      apiKeys: apiKeys.length,
      activeApiKeys: apiKeys.filter(k => k.active).length,
    }
  });
}

/**
 * Clear stored data
 */
async function clearData(request: Request, storage: Storage): Promise<Response> {
  try {
    const body = await request.json() as { type?: string };
    
    switch (body.type) {
      case 'airports':
        await storage.delete(STORAGE_KEYS.AIRPORTS);
        break;
      case 'notams':
        await storage.delete(STORAGE_KEYS.NOTAMS);
        break;
      case 'all':
        await storage.delete(STORAGE_KEYS.AIRPORTS);
        await storage.delete(STORAGE_KEYS.NOTAMS);
        break;
      default:
        return jsonResponse({ success: false, error: 'Specify type: airports, notams, or all' }, 400);
    }
    
    return jsonResponse({ success: true, message: `Cleared ${body.type} data` });
    
  } catch (error) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400);
  }
}

/**
 * JSON response helper
 */
function jsonResponse<T>(data: ApiResponse<T> | { error: string } | T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
