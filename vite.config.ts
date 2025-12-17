import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // AviationWeather.gov API proxy (official FAA weather data)
      '/api/awc': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/awc/, '/api/data'),
        headers: {
          'Accept': 'application/json',
        },
        secure: true,
      },
      // Weather API proxy (metar-taf.com) - legacy
      '/api/weather': {
        target: 'https://metar-taf.com/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
        headers: {
          'Accept': 'application/json',
        },
        secure: true,
      },
      // ICAO API proxy for airports and NOTAMs
      // Using AviationAPI.com as alternative (ICAO API may require different authentication)
      '/api/icao': {
        target: 'https://api.aviationapi.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/icao/, ''),
        headers: {
          'Accept': 'application/json',
        },
        secure: true,
      },
      // Alternative: OpenAIP for airport data
      '/api/openaip': {
        target: 'https://api.core.openaip.net/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openaip/, ''),
        headers: {
          'Accept': 'application/json',
          'x-openaip-api-key': 'ea2cd274-4785-4c82-9a54-558c8b956a06',
        },
        secure: true,
      },
    },
  },
});
