import { defineConfig, devices } from '@playwright/test';

const baseUrl = process.env.BASE_URL;

if (!baseUrl) {
  throw new Error('BASE_URL must be defined before running the Talos Playwright CI tests.');
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90000, // Increased from 60s to 90s for CI
  fullyParallel: true,
  forbidOnly: true,
  retries: 3, // Increased from 2 to 3 for CI
  workers: 2, // Reduced from 4 to 2 for better stability
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['junit', { outputFile: './playwright-results.xml' }],
    ['list'],
    ['line'], // Better for CI logs
  ],
  use: {
    baseURL: baseUrl,
    trace: 'on', // Always capture traces in CI
    screenshot: 'on', // Always capture screenshots
    video: 'on', // Always capture video
    actionTimeout: 30000, // Increased from 15s
    navigationTimeout: 45000, // Increased from 30s
    
    // Disable animations for stability
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding',
      ],
    },
    
    // More stable viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors in CI
    ignoreHTTPSErrors: true,
    
    // Permissions
    permissions: [],
    
    // User agent
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Override with more stable settings
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
    // Disable other browsers in CI for now
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // No webServer in CI - it's started separately
  webServer: undefined,
});
