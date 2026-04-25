/// <reference types="vitest" />
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Injects `VITE_CANONICAL_ORIGIN` into `index.html` meta tags (og/twitter).
// Production deploy sets this to the GitHub Pages origin including repo path.
function htmlCanonicalOrigin(): Plugin {
  return {
    name: 'gi-html-canonical-origin',
    transformIndexHtml(html) {
      const raw = process.env.VITE_CANONICAL_ORIGIN?.trim();
      const origin =
        raw && raw.length > 0
          ? raw.replace(/\/$/, '')
          : 'http://localhost:5173';
      return html.replaceAll('%VITE_CANONICAL_ORIGIN%', origin);
    },
  };
}

// `base` differs by mode: `/` in dev, `/gitInsights/` for the GH Pages build.
// React Router reads this via `import.meta.env.BASE_URL`.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/gitInsights/' : '/',
  plugins: [htmlCanonicalOrigin(), react()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
}));
