/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` differs by mode: `/` in dev, `/gitInsights/` for the GH Pages build.
// React Router reads this via `import.meta.env.BASE_URL`.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/gitInsights/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
}));
