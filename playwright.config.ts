import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 *
 * Tests are located in the e2e/ directory.
 * The dev server is started automatically via the webServer config.
 *
 * Usage:
 *   npx playwright test          # Run all E2E tests
 *   npx playwright test --ui     # Interactive UI mode
 *
 * NOTE: E2E tests require Playwright browsers installed:
 *   npx playwright install chromium
 *
 * Tests that require actual DICOM data (viewport rendering) are
 * marked test.skip and should be run locally after `npm run ingest-cases`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  /* Reasonable timeouts for a DICOM viewer app */
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Vite dev server before tests run */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
