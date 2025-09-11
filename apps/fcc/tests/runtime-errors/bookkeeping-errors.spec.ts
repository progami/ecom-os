import { test, expect, ConsoleMessage, Request } from '@playwright/test';

// Test timeout configuration
test.setTimeout(60000);

// Helper to track console errors
interface ErrorTracker {
  consoleErrors: string[];
  networkErrors: { url: string; status?: number; error?: string }[];
  pageErrors: string[];
}

// Pages to test
const BOOKKEEPING_PAGES = [
  { 
    path: '/bookkeeping', 
    name: 'Main Bookkeeping Hub',
    interactions: ['navigation-cards', 'sidebar-links']
  },
  { 
    path: '/bookkeeping/chart-of-accounts', 
    name: 'Chart of Accounts',
    interactions: ['filters', 'search', 'sync-button', 'table-sorting']
  },
  { 
    path: '/bookkeeping/sop-generator', 
    name: 'SOP Generator',
    interactions: ['form-fields', 'dropdowns', 'submit-button']
  },
  { 
    path: '/bookkeeping/sop-tables', 
    name: 'SOP Tables',
    interactions: ['tabs', 'filters', 'copy-buttons', 'table-actions']
  }
];

test.describe('Runtime Error Detection - Bookkeeping Pages', () => {
  // Helper function to set up error tracking
  async function setupErrorTracking(page: any): Promise<ErrorTracker> {
    const errorTracker: ErrorTracker = {
      consoleErrors: [],
      networkErrors: [],
      pageErrors: []
    };

    // Track console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('favicon.ico') && 
            !text.includes('Failed to load resource: the server responded with a status of 404') &&
            !text.includes('NEXT_REDIRECT') &&
            !text.includes('clear-stale-sync.js') &&
            !text.includes('Third-party cookie will be blocked')) {
          errorTracker.consoleErrors.push(text);
          console.log(`[Console Error] ${text}`);
        }
      }
    });

    // Track uncaught exceptions
    page.on('pageerror', (error: Error) => {
      // Filter out expected errors
      if (!error.message.includes('NEXT_REDIRECT')) {
        errorTracker.pageErrors.push(`Uncaught exception: ${error.message}`);
        console.log(`[Page Error] ${error.message}`);
      }
    });

    // Track network errors
    page.on('requestfailed', (request: Request) => {
      const url = request.url();
      const failure = request.failure();
      if (!url.includes('favicon.ico') && 
          !url.includes('clear-stale-sync.js') &&
          !url.includes('_next/static')) {
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
      if (status >= 400 && 
          !url.includes('favicon.ico') && 
          !url.includes('clear-stale-sync.js') &&
          !url.includes('dev_bypass')) {
        errorTracker.networkErrors.push({ url, status });
        console.log(`[HTTP Error] ${url}: ${status}`);
      }
    });

    return errorTracker;
  }

  // Test Chart of Accounts specific interactions
  async function testChartOfAccountsInteractions(page: any) {
    console.log('Testing Chart of Accounts specific interactions...');
    
    // Test search functionality
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search" i]');
    if (searchInput) {
      console.log('Testing search input...');
      await searchInput.fill('test search');
      await page.waitForTimeout(1000);
      await searchInput.clear();
    }

    // Test filter dropdowns
    const filterSelects = await page.$$('select, [role="combobox"]');
    console.log(`Found ${filterSelects.length} filter elements`);
    
    for (let i = 0; i < Math.min(filterSelects.length, 2); i++) {
      try {
        const select = filterSelects[i];
        await select.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        
        // Try to select first option
        const options = await page.$$('option, [role="option"]');
        if (options.length > 1) {
          await options[1].click({ timeout: 1000 });
        }
      } catch (e) {
        console.log(`Error testing filter ${i}: ${e.message}`);
      }
    }

    // Test sync button
    const syncButton = await page.$('button:has-text("Sync"), button:has-text("sync"), button[aria-label*="sync" i]');
    if (syncButton) {
      console.log('Found sync button');
      const isDisabled = await syncButton.isDisabled();
      if (!isDisabled) {
        console.log('Testing sync button hover...');
        await syncButton.hover();
        await page.waitForTimeout(500);
      }
    }

    // Test table sorting
    const tableHeaders = await page.$$('th[role="columnheader"], th.sortable, th');
    console.log(`Found ${tableHeaders.length} table headers`);
    
    for (let i = 0; i < Math.min(tableHeaders.length, 2); i++) {
      try {
        const header = tableHeaders[i];
        const text = await header.textContent();
        if (text && !text.includes('Actions')) {
          console.log(`Testing table header: "${text.trim()}"`);
          await header.click({ timeout: 2000 });
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`Error testing table header ${i}: ${e.message}`);
      }
    }
  }

  // Test SOP Generator specific interactions
  async function testSopGeneratorInteractions(page: any) {
    console.log('Testing SOP Generator specific interactions...');
    
    // Test form fields
    const formInputs = await page.$$('input[type="text"], textarea');
    console.log(`Found ${formInputs.length} form inputs`);
    
    for (let i = 0; i < Math.min(formInputs.length, 3); i++) {
      try {
        const input = formInputs[i];
        await input.focus();
        await input.fill('Test input');
        await page.waitForTimeout(500);
        await input.clear();
      } catch (e) {
        console.log(`Error testing form input ${i}: ${e.message}`);
      }
    }

    // Test dropdowns
    const dropdowns = await page.$$('select, [role="combobox"], [data-testid*="select"]');
    console.log(`Found ${dropdowns.length} dropdowns`);
    
    for (let i = 0; i < Math.min(dropdowns.length, 2); i++) {
      try {
        const dropdown = dropdowns[i];
        await dropdown.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        
        // Look for dropdown options
        const options = await page.$$('[role="option"], option');
        if (options.length > 0) {
          await options[0].click({ timeout: 1000 });
        }
      } catch (e) {
        console.log(`Error testing dropdown ${i}: ${e.message}`);
      }
    }

    // Test generate/submit button
    const submitButton = await page.$('button[type="submit"], button:has-text("Generate"), button:has-text("Create")');
    if (submitButton) {
      console.log('Found submit button');
      const isDisabled = await submitButton.isDisabled();
      if (!isDisabled) {
        console.log('Testing submit button hover...');
        await submitButton.hover();
        await page.waitForTimeout(500);
      }
    }
  }

  // Test SOP Tables specific interactions
  async function testSopTablesInteractions(page: any) {
    console.log('Testing SOP Tables specific interactions...');
    
    // Test tabs
    const tabs = await page.$$('[role="tab"], .tab, [class*="tab"]:not([class*="table"])');
    console.log(`Found ${tabs.length} tabs`);
    
    for (let i = 0; i < Math.min(tabs.length, 3); i++) {
      try {
        const tab = tabs[i];
        const text = await tab.textContent();
        console.log(`Clicking tab: "${text?.trim()}"`);
        await tab.click({ timeout: 2000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`Error testing tab ${i}: ${e.message}`);
      }
    }

    // Test copy buttons
    const copyButtons = await page.$$('button:has-text("Copy"), button[aria-label*="copy" i], button[title*="copy" i]');
    console.log(`Found ${copyButtons.length} copy buttons`);
    
    for (let i = 0; i < Math.min(copyButtons.length, 2); i++) {
      try {
        const button = copyButtons[i];
        await button.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        
        // Check for success message
        const toast = await page.$('.toast, [role="alert"], .notification');
        if (toast) {
          console.log('Copy action triggered notification');
        }
      } catch (e) {
        console.log(`Error testing copy button ${i}: ${e.message}`);
      }
    }

    // Test filters
    const filters = await page.$$('input[type="checkbox"], input[type="radio"]');
    console.log(`Found ${filters.length} filter checkboxes/radios`);
    
    for (let i = 0; i < Math.min(filters.length, 3); i++) {
      try {
        const filter = filters[i];
        await filter.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      } catch (e) {
        console.log(`Error testing filter ${i}: ${e.message}`);
      }
    }
  }

  // Test each bookkeeping page
  for (const pageInfo of BOOKKEEPING_PAGES) {
    test(`${pageInfo.name} - Check for runtime errors`, async ({ page }) => {
      console.log(`\n=== Testing ${pageInfo.name} ===`);
      console.log(`URL: ${pageInfo.path}`);
      const errorTracker = await setupErrorTracking(page);

      // Navigate with dev bypass
      const response = await page.goto(`${pageInfo.path}?dev_bypass=true`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Check if page loaded successfully
      if (response) {
        expect(response.status()).toBeLessThan(400);
        console.log(`Page loaded with status: ${response.status()}`);
      }

      // Wait for page to stabilize
      await page.waitForTimeout(3000);
      
      // Wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        console.log('Network did not reach idle state within 5s');
      });

      // Check page title
      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Take screenshot for debugging
      await page.screenshot({ 
        path: `tests/screenshots/bookkeeping-${pageInfo.path.replace(/\//g, '-')}.png`,
        fullPage: true 
      });

      // Test page-specific interactions
      if (pageInfo.path === '/bookkeeping/chart-of-accounts') {
        await testChartOfAccountsInteractions(page);
      } else if (pageInfo.path === '/bookkeeping/sop-generator') {
        await testSopGeneratorInteractions(page);
      } else if (pageInfo.path === '/bookkeeping/sop-tables') {
        await testSopTablesInteractions(page);
      }

      // Test common interactive elements
      console.log('\nTesting common interactive elements...');
      
      // Test all visible buttons
      const buttons = await page.$$('button:visible');
      console.log(`Found ${buttons.length} visible buttons`);
      
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        try {
          const button = buttons[i];
          const text = await button.textContent();
          const isDisabled = await button.isDisabled();
          
          if (!isDisabled && text && 
              !text.includes('Sign out') && 
              !text.includes('Logout') &&
              !text.includes('Delete')) {
            console.log(`Testing button: "${text.trim()}"`);
            await button.hover({ timeout: 2000 }).catch(e => {
              console.log(`Could not hover on button: ${e.message}`);
            });
            await page.waitForTimeout(300);
          }
        } catch (e) {
          console.log(`Error testing button ${i}: ${e.message}`);
        }
      }

      // Test links
      const links = await page.$$('a[href]:visible');
      console.log(`Found ${links.length} visible links`);
      
      for (let i = 0; i < Math.min(links.length, 5); i++) {
        try {
          const link = links[i];
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          
          if (href && !href.startsWith('http') && !href.includes('mailto:')) {
            console.log(`Testing link: "${text?.trim()}" (${href})`);
            await link.hover({ timeout: 2000 }).catch(e => {
              console.log(`Could not hover on link: ${e.message}`);
            });
            await page.waitForTimeout(300);
          }
        } catch (e) {
          console.log(`Error testing link ${i}: ${e.message}`);
        }
      }

      // Check for loading indicators
      const loadingElements = await page.$$('[class*="loading"], [class*="spinner"], [class*="skeleton"]');
      if (loadingElements.length > 0) {
        console.log(`Found ${loadingElements.length} loading indicators, waiting...`);
        await page.waitForTimeout(3000);
      }

      // Final error summary
      console.log('\n--- Error Summary ---');
      console.log(`Console errors: ${errorTracker.consoleErrors.length}`);
      console.log(`Page errors: ${errorTracker.pageErrors.length}`);
      console.log(`Network errors: ${errorTracker.networkErrors.length}`);

      // Report errors if any
      if (errorTracker.consoleErrors.length > 0) {
        console.log('\nConsole Errors Found:');
        errorTracker.consoleErrors.forEach((error, i) => {
          console.log(`${i + 1}. ${error}`);
        });
      }

      if (errorTracker.pageErrors.length > 0) {
        console.log('\nPage Errors Found:');
        errorTracker.pageErrors.forEach((error, i) => {
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
      expect(errorTracker.pageErrors.length).toBe(0);
      expect(errorTracker.networkErrors.length).toBe(0);
    });
  }

  // API call monitoring test
  test('Monitor API calls across all bookkeeping pages', async ({ page }) => {
    console.log('\n=== API Call Monitoring Test ===');
    
    const apiCalls: { url: string; status: number; method: string }[] = [];
    
    // Monitor all API calls
    page.on('response', (response: any) => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiCalls.push({
          url,
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Visit each page
    for (const pageInfo of BOOKKEEPING_PAGES) {
      console.log(`\nChecking API calls for ${pageInfo.name}...`);
      
      await page.goto(`${pageInfo.path}?dev_bypass=true`, {
        waitUntil: 'networkidle',
        timeout: 30000
      }).catch(e => console.log(`Navigation error: ${e.message}`));
      
      await page.waitForTimeout(2000);
    }

    // Report API calls
    console.log('\n--- API Call Summary ---');
    console.log(`Total API calls: ${apiCalls.length}`);
    
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    if (failedCalls.length > 0) {
      console.log('\nFailed API Calls:');
      failedCalls.forEach((call, i) => {
        console.log(`${i + 1}. ${call.method} ${call.url} - Status: ${call.status}`);
      });
    }

    // Group by endpoint
    const endpointGroups = apiCalls.reduce((acc, call) => {
      const endpoint = call.url.split('?')[0];
      if (!acc[endpoint]) {
        acc[endpoint] = [];
      }
      acc[endpoint].push(call);
      return acc;
    }, {} as Record<string, typeof apiCalls>);

    console.log('\nAPI Endpoints Called:');
    Object.entries(endpointGroups).forEach(([endpoint, calls]) => {
      console.log(`- ${endpoint}: ${calls.length} calls`);
    });

    // Assertions
    expect(failedCalls.length).toBe(0);
  });

  // Stress test - rapid interaction
  test('Stress test - Rapid interactions', async ({ page }) => {
    console.log('\n=== Stress Test - Rapid Interactions ===');
    const errorTracker = await setupErrorTracking(page);

    // Navigate to Chart of Accounts (most interactive page)
    await page.goto('/bookkeeping/chart-of-accounts?dev_bypass=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Rapid filter changes
    console.log('Testing rapid filter changes...');
    const selects = await page.$$('select');
    for (let i = 0; i < 5; i++) {
      for (const select of selects.slice(0, 2)) {
        try {
          await select.selectOption({ index: i % 3 });
          await page.waitForTimeout(100);
        } catch (e) {
          // Continue on error
        }
      }
    }

    // Rapid search
    console.log('Testing rapid search...');
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search" i]');
    if (searchInput) {
      for (let i = 0; i < 10; i++) {
        await searchInput.fill(`test ${i}`);
        await page.waitForTimeout(100);
      }
      await searchInput.clear();
    }

    // Check for errors after stress test
    console.log('\n--- Stress Test Results ---');
    console.log(`Console errors: ${errorTracker.consoleErrors.length}`);
    console.log(`Page errors: ${errorTracker.pageErrors.length}`);
    console.log(`Network errors: ${errorTracker.networkErrors.length}`);

    // More lenient for stress test
    expect(errorTracker.consoleErrors.length).toBeLessThan(10);
    expect(errorTracker.pageErrors.length).toBeLessThan(5);
  });
});