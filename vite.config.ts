import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png', 'brand/*.webp'],
      injectManifest: {
        // Precache only the app shell; page chunks are cached on first use.
        globPatterns: ['index.html', 'assets/*.css', 'assets/{index,react,supabase,query,ui}-*.js', 'brand/mark*.webp', 'icons/icon-192.png', 'favicon.png'],
      },
      manifest: {
        name: 'ProfJero Edu',
        short_name: 'ProfJero Edu',
        description: 'Learning Without Limits — a digital learning ecosystem for learners, educators and institutions.',
        theme_color: '#1554D6',
        background_color: '#F7F9FC',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'My Learning', url: '/learn/courses' },
          { name: 'Code Lab', url: '/lab/code' },
          { name: 'Challenge Arena', url: '/arena' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'api/test/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
