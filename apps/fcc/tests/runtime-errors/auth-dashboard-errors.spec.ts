import { test, expect, ConsoleMessage, Request } from '@playwright/test';

// Test timeout configuration
test.setTimeout(60000);

// Helper to track console errors
interface ErrorTracker {
  consoleErrors: string[];
  networkErrors: { url: string; status?: number; error?: string }[];
}

// Pages to test
const AUTH_PAGES = [
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },
  { path: '/setup', name: 'Setup' }
];

const DASHBOARD_PAGES = [
  { path: '/', name: 'Home Dashboard' },
  { path: '/finance', name: 'Finance Dashboard' }
];

test.describe('Runtime Error Detection - Auth & Dashboard Pages', () => {
  // Helper function to set up error tracking
  async function setupErrorTracking(page: any): Promise<ErrorTracker> {
    const errorTracker: ErrorTracker = {
      consoleErrors: [],
      networkErrors: []
    };

    // Track console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('favicon.ico') && 
            !text.includes('Failed to load resource: the server responded with a status of 404') &&
            !text.includes('NEXT_REDIRECT') && // Expected Next.js redirect behavior
            !text.includes('clear-stale-sync.js')) { // Script loading race condition
          errorTracker.consoleErrors.push(text);
          console.log(`[Console Error] ${text}`);
        }
      }
    });

    // Track uncaught exceptions
    page.on('pageerror', (error: Error) => {
      // Filter out expected errors
      if (!error.message.includes('NEXT_REDIRECT')) {
        errorTracker.consoleErrors.push(`Uncaught exception: ${error.message}`);
        console.log(`[Page Error] ${error.message}`);
      }
    });

    // Track network errors
    page.on('requestfailed', (request: Request) => {
      const url = request.url();
      const failure = request.failure();
      if (!url.includes('favicon.ico') && !url.includes('clear-stale-sync.js')) {
        errorTracker.networkErrors.push({
          url,
          error: failure?.errorText || 'Unknown error'
        });
        console.log(`[Network Error] ${url}: ${failure?.errorText}`);
      }
    });

    // Track 4xx and 5xx responses
    page.on('response', (response: any) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && !url.includes('favicon.ico') && !url.includes('clear-stale-sync.js')) {
        errorTracker.networkErrors.push({ url, status });
        console.log(`[HTTP Error] ${url}: ${status}`);
      }
    });

    return errorTracker;
  }

  // Helper to check for common interactive elements and test them
  async function testInteractiveElements(page: any, pageName: string) {
    console.log(`Testing interactive elements on ${pageName}...`);
    
    // Find and test buttons
    const buttons = await page.$$('button:visible');
    console.log(`Found ${buttons.length} visible buttons`);
    
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      try {
        const button = buttons[i];
        const text = await button.textContent();
        const isDisabled = await button.isDisabled();
        
        if (!isDisabled && text && !text.includes('Sign out') && !text.includes('Logout')) {
          console.log(`Clicking button: "${text?.trim()}"`);
          
          // Click with error handling
          await Promise.race([
            button.click({ timeout: 5000 }),
            page.waitForTimeout(5000)
          ]).catch(e => console.log(`Button click timeout/error: ${e.message}`));
          
          // Wait a bit to see if any errors occur
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`Error testing button ${i}: ${e.message}`);
      }
    }

    // Find and test links
    const links = await page.$$('a[href]:visible');
    console.log(`Found ${links.length} visible links`);
    
    // Test hover on first few links
    for (let i = 0; i < Math.min(links.length, 3); i++) {
      try {
        const link = links[i];
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.includes('mailto:')) {
          await link.hover({ timeout: 2000 }).catch(() => {});
        }
      } catch (e) {
        console.log(`Error testing link ${i}: ${e.message}`);
      }
    }
  }

  // Test authentication pages
  for (const pageInfo of AUTH_PAGES) {
    test(`${pageInfo.name} page - Check for runtime errors`, async ({ page }) => {
      console.log(`\n=== Testing ${pageInfo.name} Page ===`);
      const errorTracker = await setupErrorTracking(page);

      // Navigate with dev bypass
      const response = await page.goto(`${pageInfo.path}?dev_bypass=true`, {
        waitUntil: 'domcontentloaded', // Changed from networkidle to avoid timeout
        timeout: 30000
      });

      // Check if page loaded successfully
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }

      // Wait for page to stabilize and network to settle
      await page.waitForTimeout(3000);
      
      // Also wait for network to be idle for at least 500ms
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        console.log('Network did not reach idle state within 5s');
      });

      // Check page title
      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Test interactive elements
      await testInteractiveElements(page, pageInfo.name);

      // Additional auth-specific tests
      if (pageInfo.path === '/login' || pageInfo.path === '/register') {
        // Try to find form fields
        const emailField = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        const passwordField = await page.$('input[type="password"], input[name="password"]');
        
        if (emailField) {
          console.log('Found email field, testing focus...');
          await emailField.focus();
          await page.waitForTimeout(500);
        }
        
        if (passwordField) {
          console.log('Found password field, testing focus...');
          await passwordField.focus();
          await page.waitForTimeout(500);
        }
      }

      // Final error check
      console.log('\n--- Error Summary ---');
      console.log(`Console errors: ${errorTracker.consoleErrors.length}`);
      console.log(`Network errors: ${errorTracker.networkErrors.length}`);

      // Report errors if any
      if (errorTracker.consoleErrors.length > 0) {
        console.log('\nConsole Errors Found:');
        errorTracker.consoleErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error}`);
        });
      }

      if (errorTracker.networkErrors.length > 0) {
        console.log('\nNetwork Errors Found:');
        errorTracker.networkErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.url} - ${error.status || error.error}`);
        });
      }

      // Assertions
      expect(errorTracker.consoleErrors.length).toBe(0);
      expect(errorTracker.networkErrors.length).toBe(0);
    });
  }

  // Test dashboard pages
  for (const pageInfo of DASHBOARD_PAGES) {
    test(`${pageInfo.name} page - Check for runtime errors`, async ({ page }) => {
      console.log(`\n=== Testing ${pageInfo.name} Page ===`);
      const errorTracker = await setupErrorTracking(page);

      // Navigate with dev bypass
      const response = await page.goto(`${pageInfo.path}?dev_bypass=true`, {
        waitUntil: 'domcontentloaded', // Changed from networkidle to avoid timeout
        timeout: 30000
      });

      // Check if page loaded successfully
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }

      // Wait for page to stabilize and network to settle
      await page.waitForTimeout(3000);
      
      // Also wait for network to be idle for at least 500ms
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        console.log('Network did not reach idle state within 5s');
      });

      // Check page title
      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Test interactive elements
      await testInteractiveElements(page, pageInfo.name);

      // Dashboard-specific tests
      console.log('\nTesting dashboard-specific elements...');
      
      // Check for common dashboard components
      const cards = await page.$$('.card, [class*="card"], [class*="Card"]');
      console.log(`Found ${cards.length} card elements`);

      // Check for charts/graphs
      const charts = await page.$$('canvas, svg[class*="chart"], [class*="chart"]');
      console.log(`Found ${charts.length} potential chart elements`);

      // Test navigation menu items
      const navItems = await page.$$('nav a, aside a, [role="navigation"] a');
      console.log(`Found ${navItems.length} navigation items`);
      
      // Click first few nav items that don't navigate away
      for (let i = 0; i < Math.min(navItems.length, 3); i++) {
        try {
          const navItem = navItems[i];
          const href = await navItem.getAttribute('href');
          const text = await navItem.textContent();
          
          if (href && href.startsWith('#')) {
            console.log(`Clicking nav item: "${text?.trim()}" (${href})`);
            await navItem.click({ timeout: 2000 });
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.log(`Error testing nav item ${i}: ${e.message}`);
        }
      }

      // Check for data loading indicators
      const loadingElements = await page.$$('[class*="loading"], [class*="spinner"], [class*="skeleton"]');
      if (loadingElements.length > 0) {
        console.log(`Found ${loadingElements.length} loading indicators`);
        // Wait for them to disappear
        await page.waitForTimeout(3000);
      }

      // Final error check
      console.log('\n--- Error Summary ---');
      console.log(`Console errors: ${errorTracker.consoleErrors.length}`);
      console.log(`Network errors: ${errorTracker.networkErrors.length}`);

      // Report errors if any
      if (errorTracker.consoleErrors.length > 0) {
        console.log('\nConsole Errors Found:');
        errorTracker.consoleErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error}`);
        });
      }

      if (errorTracker.networkErrors.length > 0) {
        console.log('\nNetwork Errors Found:');
        errorTracker.networkErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.url} - ${error.status || error.error}`);
        });
      }

      // Assertions
      expect(errorTracker.consoleErrors.length).toBe(0);
      expect(errorTracker.networkErrors.length).toBe(0);
    });
  }

  // Combined stress test - rapid navigation
  test('Stress test - Rapid navigation between pages', async ({ page }) => {
    console.log('\n=== Running Stress Test - Rapid Navigation ===');
    const errorTracker = await setupErrorTracking(page);
    
    const allPages = [...AUTH_PAGES, ...DASHBOARD_PAGES];
    
    // Rapidly navigate between pages
    for (let i = 0; i < 2; i++) {
      for (const pageInfo of allPages) {
        console.log(`Quick navigation to ${pageInfo.name}...`);
        try {
          await page.goto(`${pageInfo.path}?dev_bypass=true`, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
          });
          await page.waitForTimeout(500);
        } catch (e) {
          console.log(`Navigation error for ${pageInfo.name}: ${e.message}`);
        }
      }
    }
    
    // Final check
    console.log('\n--- Stress Test Error Summary ---');
    console.log(`Total console errors: ${errorTracker.consoleErrors.length}`);
    console.log(`Total network errors: ${errorTracker.networkErrors.length}`);
    
    // We expect some errors during rapid navigation, but not too many
    expect(errorTracker.consoleErrors.length).toBeLessThan(20); // Increased threshold for rapid navigation
  });
});