import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './performance',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Performance tests should run sequentially for accurate measurements
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Minimal retries for performance tests
  workers: 1, // Single worker for consistent performance measurements
  reporter: [
    ['html', { outputFolder: 'playwright-report/performance' }],
    ['junit', { outputFile: 'performance-results.xml' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000, // Longer timeout for performance tests
    navigationTimeout: 60000, // Longer navigation timeout
    
    // Performance-specific settings
    launchOptions: {
      // Enable performance metrics collection
      args: [
        '--enable-precise-memory-info',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    },
    
    // Viewport settings for consistent measurements
    viewport: { width: 1280, height: 720 },
    
    // Disable animations for consistent timing
    reducedMotion: 'reduce',
    
    // Network conditions (comment out for real network testing)
    // offline: false,
    // httpCredentials: undefined,
  },

  projects: [
    {
      name: 'chromium-performance',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable Chrome DevTools Protocol for performance metrics
        contextOptions: {
          // Enable performance timeline recording
          recordHar: {
            path: 'performance-har',
            mode: 'minimal'
          }
        }
      },
    },
    // Optionally test on other browsers
    {
      name: 'firefox-performance',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-performance',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Timeout configuration for performance tests
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Web server configuration
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // 3 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },

  
  // Global setup/teardown for performance testing
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Output directory for test artifacts
  outputDir: 'test-results/performance',
});