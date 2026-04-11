import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Use cloud dev server URLs (not localhost) since we're on a DigitalOcean droplet
    baseURL: 'https://devwebapp.ohbeef.com',
    trace: 'on-first-retry',
    // Ignore HTTPS certificate errors for self-signed dev certs
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer config needed - the dev server runs separately via screen sessions
});
