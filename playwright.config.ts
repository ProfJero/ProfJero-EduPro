import { defineConfig, devices } from '@playwright/test';

/** E2E against the local Supabase stack + Cloudflare Pages runtime (wrangler). */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8788',
    trace: 'off',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npx wrangler pages dev dist --port 8788 --compatibility-date=2026-11-01',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
