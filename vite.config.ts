import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Change this to '/' if deploying to a custom domain
  base: '/flight-planner/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    // NOTE: In production, all API calls go through the Cloudflare Worker.
    // These proxies are ONLY for local development fallback.
    // The frontend should use VITE_WORKER_URL from .env
  },
  build: {
    // Output directory for production build
    outDir: 'dist',
    // Enable source maps for debugging
    sourcemap: true,
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'gsap-vendor': ['gsap'],
        },
      },
    },
  },
});
