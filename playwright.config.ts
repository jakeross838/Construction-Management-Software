import { defineConfig, devices } from '@playwright/test';

/**
 * Ross Built CMS - Playwright Test Configuration
 *
 * This configuration supports both legacy tests (tests/*.spec.js)
 * and new E2E tests (tests/e2e/*.spec.ts)
 */
export default defineConfig({
  // Include both legacy tests and new e2e tests
  testDir: './tests',
  testMatch: ['**/*.spec.ts', '**/*.spec.js'],

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Use 50% of available workers */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],

  /* Shared settings for all tests */
  use: {
    /* Base URL for the app */
    baseURL: 'http://localhost:3001',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'on-first-retry',

    /* Default timeout for actions */
    actionTimeout: 10000,

    /* Default navigation timeout */
    navigationTimeout: 30000,
  },

  /* Global timeout for each test */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on additional browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
