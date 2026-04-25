import { defineConfig, devices } from '@playwright/test';

const port = 5182;
const basePath = '/gitInsights';

const webServerCommand = process.env.CI
  ? `vite preview --host 127.0.0.1 --port ${port} --strictPort`
  : `npm run build && vite preview --host 127.0.0.1 --port ${port} --strictPort`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    ...devices['Pixel 5'],
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
