import { defineConfig, devices } from '@playwright/test';

/**
 * Temporary config for runtime error testing with existing server
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: undefined
      },
    },
  ],

  // No webServer - use existing running server
  
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  outputDir: 'test-results/',
});