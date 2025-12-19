/**
 * Storage Service
 * Abstraction over KV storage with fallback to in-memory for local dev
 */

import { Env } from './types';

// In-memory storage fallback for local development
const memoryStore = new Map<string, string>();

export class Storage {
  private kv: KVNamespace | null;
  
  constructor(env: Env) {
    this.kv = env.DATA_KV || null;
  }
  
  /**
   * Get value from storage
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.kv) {
        const value = await this.kv.get(key);
        return value ? JSON.parse(value) : null;
      }
      // Fallback to memory
      const value = memoryStore.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Storage.get error for key ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Set value in storage
   */
  async set<T>(key: string, value: T, options?: { expirationTtl?: number }): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.kv) {
        await this.kv.put(key, serialized, options);
      } else {
        // Fallback to memory
        memoryStore.set(key, serialized);
      }
    } catch (error) {
      console.error(`Storage.set error for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete value from storage
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.kv) {
        await this.kv.delete(key);
      } else {
        memoryStore.delete(key);
      }
    } catch (error) {
      console.error(`Storage.delete error for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * List keys with prefix
   */
  async list(prefix: string): Promise<string[]> {
    try {
      if (this.kv) {
        const result = await this.kv.list({ prefix });
        return result.keys.map(k => k.name);
      }
      // Fallback to memory
      return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
    } catch (error) {
      console.error(`Storage.list error for prefix ${prefix}:`, error);
      return [];
    }
  }
  
  /**
   * Get all data by prefix and merge
   */
  async getAll<T>(prefix: string): Promise<T[]> {
    const keys = await this.list(prefix);
    const results: T[] = [];
    
    for (const key of keys) {
      const data = await this.get<T[]>(key);
      if (data) {
        results.push(...data);
      }
    }
    
    return results;
  }
  
  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}

/**
 * Clear in-memory storage (for testing)
 */
export function clearMemoryStore(): void {
  memoryStore.clear();
}
