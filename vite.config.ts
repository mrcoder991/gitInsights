/// <reference types="vitest" />
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Replaces `%VITE_CANONICAL_ORIGIN%` and `%VITE_UMAMI_WEBSITE_ID%` placeholders
// in index.html at build time. When the Umami ID is absent (local dev), the
// entire <script> tag is stripped so no request is made to cloud.umami.is.
function htmlEnvInjection(): Plugin {
  return {
    name: 'gi-html-env-injection',
    transformIndexHtml(html) {
      const rawOrigin = process.env.VITE_CANONICAL_ORIGIN?.trim();
      const origin =
        rawOrigin && rawOrigin.length > 0
          ? rawOrigin.replace(/\/$/, '')
          : 'http://localhost:5173';
      let out = html.replaceAll('%VITE_CANONICAL_ORIGIN%', origin);

      const umamiId = process.env.VITE_UMAMI_WEBSITE_ID?.trim();
      if (umamiId && umamiId.length > 0) {
        out = out.replaceAll('%VITE_UMAMI_WEBSITE_ID%', umamiId);
      } else {
        out = out.replace(
          /<script[^>]*data-website-id="%VITE_UMAMI_WEBSITE_ID%"[^>]*><\/script>\n?\s*/,
          '',
        );
      }

      return out;
    },
  };
}

// `base` differs by mode: `/` in dev, `/gitInsights/` for the GH Pages build.
// React Router reads this via `import.meta.env.BASE_URL`.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/gitInsights/' : '/',
  plugins: [htmlEnvInjection(), react()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
}));
