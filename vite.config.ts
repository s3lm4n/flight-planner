import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path - use '/' for Cloudflare Workers
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    // Proxy API calls to local worker during development
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/admin/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output directory for production build
    outDir: 'dist',
    // Enable source maps for debugging
    sourcemap: true,
    // Multi-page build config
    rollupOptions: {
      input: {
        // Public app entry
        main: resolve(__dirname, 'index.html'),
        // Admin panel entry
        admin: resolve(__dirname, 'admin.html'),
      },
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
