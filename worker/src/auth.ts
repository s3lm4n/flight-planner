import { Env, AdminSession, ApiKey, STORAGE_KEYS } from './types';
import { Storage } from './storage';

const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * Validate admin authentication
 * Supports both session token and password
 */
export async function validateAdminAuth(request: Request, env: Env): Promise<{ valid: boolean; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  const sessionToken = request.headers.get('X-Admin-Session');
  
  // Check session token first
  if (sessionToken) {
    const isValid = await validateAdminSession(sessionToken, env);
    if (isValid) {
      return { valid: true };
    }
  }
  
  // Check basic auth
  if (authHeader?.startsWith('Basic ')) {
    const credentials = atob(authHeader.slice(6));
    const [username, password] = credentials.split(':');
    
    if (username === 'admin' && validateAdminPassword(password, env)) {
      return { valid: true };
    }
  }
  
  return { valid: false, error: 'Invalid credentials' };
}

function validateAdminPassword(password: string, env: Env): boolean {
  if (!env.ADMIN_PASSWORD) {
    return false;
  }
  return password === env.ADMIN_PASSWORD;
}

/**
 * Create admin session after successful login
 */
export async function createAdminSession(env: Env): Promise<AdminSession> {
  const token = generateToken(32);
  const now = Date.now();
  
  const session: AdminSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  };
  
  // Store session
  const storage = new Storage(env);
  const sessions = await storage.get<AdminSession[]>(STORAGE_KEYS.ADMIN_SESSIONS) || [];
  
  // Clean expired sessions
  const validSessions = sessions.filter(s => s.expiresAt > now);
  validSessions.push(session);
  
  await storage.set(STORAGE_KEYS.ADMIN_SESSIONS, validSessions);
  
  return session;
}

/**
 * Validate admin session token
 */
async function validateAdminSession(token: string, env: Env): Promise<boolean> {
  const storage = new Storage(env);
  const sessions = await storage.get<AdminSession[]>(STORAGE_KEYS.ADMIN_SESSIONS) || [];
  
  const session = sessions.find(s => s.token === token);
  if (!session) return false;
  
  return session.expiresAt > Date.now();
}

/**
 * Validate API key for public API access
 */
export async function validateApiKey(request: Request, env: Env): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }> {
  const apiKeyHeader = request.headers.get('X-API-Key');
  const authHeader = request.headers.get('Authorization');
  
  let keyValue: string | null = null;
  
  // Check X-API-Key header
  if (apiKeyHeader) {
    keyValue = apiKeyHeader;
  }
  // Check Bearer token
  else if (authHeader?.startsWith('Bearer ')) {
    keyValue = authHeader.slice(7);
  }
  
  if (!keyValue) {
    return { valid: false, error: 'API key required' };
  }
  
  // Look up API key
  const storage = new Storage(env);
  const apiKeys = await storage.get<ApiKey[]>(STORAGE_KEYS.API_KEYS) || [];
  
  const apiKey = apiKeys.find(k => k.key === keyValue && k.active);
  
  if (!apiKey) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // Update last used timestamp
  apiKey.lastUsed = new Date().toISOString();
  await storage.set(STORAGE_KEYS.API_KEYS, apiKeys);
  
  return { valid: true, apiKey };
}

/**
 * Generate random token
 */
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Generate API key with prefix
 */
export function generateApiKey(): string {
  return `fp_${generateToken(32)}`;
}

/**
 * Unauthorized response helper
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic realm="Admin Panel"',
    }
  });
}
