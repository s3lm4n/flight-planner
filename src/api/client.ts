/**
 * API Configuration and Axios Instance
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// API Key for metar-taf.com
const WEATHER_API_KEY = 'DYAbhwvbj1CyKIWMDIIuFQD2BBvUjKYU';

// Base URLs
const WEATHER_API_BASE_URL = '/api/weather'; // Proxied through Vite

/**
 * Create axios instance for weather API
 */
export const weatherApi: AxiosInstance = axios.create({
  baseURL: WEATHER_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  params: {
    api_key: WEATHER_API_KEY,
  },
});

/**
 * Error handler for API calls
 */
export function handleApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      // Server responded with error status
      const status = axiosError.response.status;
      const message = (axiosError.response.data as { message?: string })?.message;
      
      switch (status) {
        case 400:
          throw new Error(`Bad Request: ${message || 'Invalid parameters'}`);
        case 401:
          throw new Error('Authentication failed. Check API key.');
        case 403:
          throw new Error('Access forbidden. API key may be invalid or expired.');
        case 404:
          throw new Error('Resource not found. Check ICAO codes.');
        case 429:
          throw new Error('Rate limit exceeded. Please wait before retrying.');
        case 500:
          throw new Error('Weather server error. Please try again later.');
        default:
          throw new Error(`API Error (${status}): ${message || 'Unknown error'}`);
      }
    } else if (axiosError.request) {
      // Request was made but no response received
      throw new Error('No response from weather server. Check your connection.');
    } else {
      // Error in request setup
      throw new Error(`Request error: ${axiosError.message}`);
    }
  }
  
  // Non-Axios error
  throw error instanceof Error ? error : new Error('Unknown error occurred');
}

/**
 * Retry mechanism for failed requests
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (
          error.message.includes('Authentication') ||
          error.message.includes('forbidden') ||
          error.message.includes('Bad Request')
        ) {
          throw error;
        }
      }
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
