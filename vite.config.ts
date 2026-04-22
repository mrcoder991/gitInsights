/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is set so the app works both at the root in dev and under
// `/gitInsights/` on GitHub Pages. React Router reads this via
// `import.meta.env.BASE_URL` to compute its `basename`.
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
