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
      // Weather API proxy (metar-taf.com)
      '/api/weather': {
        target: 'https://metar-taf.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
        headers: {
          'Accept': 'application/json',
        },
      },
      // ICAO API proxy for airports and NOTAMs
      '/api/icao': {
        target: 'https://applications.icao.int/dataservices/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/icao/, ''),
        headers: {
          'api-key': 'ea2cd274-4785-4c82-9a54-558c8b956a06',
          'Accept': 'application/json',
        },
      },
    },
  },
});
