/** Prepare one real Chromium journey worker with environment-driven serving. */
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const host = env.VITE_HOST || '127.0.0.1';
const port = env.VITE_PORT || '5173';
const baseURL = env.E2E_BASE_URL || `http://${host}:${port}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: './test-results',
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    env: { VITE_HOST: host, VITE_PORT: port },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
