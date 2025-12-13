import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('All Reports Runtime Error Check', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Enable console monitoring
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    // Monitor for uncaught exceptions
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
    });
  });

  test.afterEach(async () => {
    // Check for runtime errors after each test
    const allErrors = helpers.getRuntimeErrors();
    const criticalErrors = allErrors.filter(error => 
      !error.message.includes('404 (Not Found)') &&
      !error.message.includes('No aged payables data available') &&
      !error.message.includes('No aged receivables data available') &&
      !error.message.includes('No cash flow data available') &&
      !error.message.includes('No trial balance data available') &&
      !error.message.includes('No general ledger data available') &&
      !error.message.includes('No balance sheet data available') &&
      !error.message.includes('No profit loss data available') &&
      !error.message.includes('No data available') &&
      !error.message.includes('Failed to fetch') &&
      !error.message.includes('Warning:') &&
      !error.message.includes('500 (Internal Server Error)') &&
      !error.message.includes('Failed to load resource') &&
      error.source !== 'network'
    );
    
    if (criticalErrors.length > 0) {
      throw new Error(`Critical runtime errors detected:\n\n${criticalErrors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  const reportPages = [
    { 
      path: '/reports', 
      name: 'Reports Hub',
      expectedElements: ['h2:has-text("Available Reports")', '.bg-secondary.backdrop-blur-sm.border']
    },
    { 
      path: '/reports/balance-sheet', 
      name: 'Balance Sheet',
      expectedElements: ['h1:has-text("Balance Sheet")', 'button:has-text("Export")']
    },
    { 
      path: '/reports/profit-loss', 
      name: 'Profit & Loss',
      expectedElements: ['h1:has-text("Profit & Loss")', 'button:has-text("Export")']
    },
    { 
      path: '/reports/cash-flow', 
      name: 'Cash Flow Statement',
      expectedElements: ['h1:has-text("Cash Flow")', 'button:has-text("Export")']
    },
    { 
      path: '/reports/trial-balance', 
      name: 'Trial Balance',
      expectedElements: ['h1:has-text("Trial Balance")', 'button:has-text("Export")']
    },
    { 
      path: '/reports/general-ledger', 
      name: 'General Ledger',
      expectedElements: ['h1:has-text("General Ledger")', 'button:has-text("Export")']
    },
    { 
      name: 'Aged Payables',
      expectedElements: ['h1:has-text("Aged Payables")', 'button:has-text("Export")']
    },
    { 
      name: 'Aged Receivables',
      expectedElements: ['h1:has-text("Aged Receivables")', 'button:has-text("Export")']
    },
    { 
      path: '/reports/import', 
      name: 'Import Reports',
      expectedElements: ['h1:has-text("Import")', 'form, [data-testid="import-form"]']
    }
  ];

  for (const report of reportPages) {
    test(`${report.name} should load without runtime errors`, async ({ page }) => {
      // Navigate to the page
      await helpers.navigateWithDevBypass(report.path);
      
      // Wait for page to load
      if (report.name === 'Import Reports') {
        await page.waitForSelector('form, [data-testid="import-form"], h1:has-text("Import")', { 
          timeout: 15000 
        });
      } else {
        await helpers.waitForReportPage(report.name, 15000);
      }
      
      // Verify page title is correct
      const pageTitle = await page.title();
      console.log(`Page title for ${report.name}: ${pageTitle}`);
      
      // Check for main content area
      const mainContent = page.locator('main, [role="main"], .main-content').first();
      await expect(mainContent).toBeVisible({ timeout: 10000 });
      
      // Check for expected elements
      let foundExpectedElement = false;
      for (const selector of report.expectedElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundExpectedElement = true;
          console.log(`Found expected element: ${selector}`);
          break;
        }
      }
      
      // If no expected elements found, check for empty state
      if (!foundExpectedElement) {
        const hasEmptyState = await helpers.hasEmptyState();
        console.log(`${report.name} - Has empty state: ${hasEmptyState}`);
        expect(hasEmptyState).toBe(true);
      }
      
      // Check for "undefined" errors in the visible text
      const pageText = await page.locator('body').innerText();
      expect(pageText).not.toContain('undefined');
      expect(pageText).not.toContain('null');
      expect(pageText).not.toContain('NaN');
      
      // Wait a bit to catch any delayed errors
      await page.waitForTimeout(2000);
      
      // Log successful load
      console.log(`✓ ${report.name} loaded successfully`);
    });
  }

  test('Sequential navigation through all reports', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for full navigation test
    
    const results = [];
    
    for (const report of reportPages) {
      console.log(`Navigating to ${report.name}...`);
      
      try {
        await helpers.navigateWithDevBypass(report.path);
        
        // Wait for page to load
        if (report.name === 'Import Reports') {
          await page.waitForSelector('form, [data-testid="import-form"], h1:has-text("Import")', { 
            timeout: 15000 
          });
        } else {
          await helpers.waitForReportPage(report.name, 15000);
        }
        
        // Check for errors
        const errors = helpers.getRuntimeErrors();
        const hasEmptyState = await helpers.hasEmptyState();
        const hasData = await helpers.hasDataContent();
        
        results.push({
          page: report.name,
          path: report.path,
          loaded: true,
          hasEmptyState,
          hasData,
          errorCount: errors.length
        });
        
        // Clear errors for next page
        helpers.clearRuntimeErrors();
        
        // Small delay between navigations
        await page.waitForTimeout(1000);
        
      } catch (error) {
        results.push({
          page: report.name,
          path: report.path,
          loaded: false,
          error: error.message
        });
      }
    }
    
    // Log summary
    console.log('\n=== Navigation Test Summary ===');
    for (const result of results) {
      if (result.loaded) {
        console.log(`✓ ${result.page}: Loaded successfully (Empty: ${result.hasEmptyState}, Data: ${result.hasData}, Errors: ${result.errorCount})`);
      } else {
        console.log(`✗ ${result.page}: Failed to load - ${result.error}`);
      }
    }
    
    // All pages should have loaded
    const failedPages = results.filter(r => !r.loaded);
    expect(failedPages).toHaveLength(0);
  });

  test('Check for console errors on each page', async ({ page }) => {
    const consoleErrors = [];
    
    // Set up console error monitoring
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          page: page.url(),
          message: msg.text(),
          location: msg.location()
        });
      }
    });
    
    for (const report of reportPages) {
      consoleErrors.length = 0; // Clear for each page
      
      await helpers.navigateWithDevBypass(report.path);
      await page.waitForTimeout(3000); // Wait for any delayed errors
      
      if (consoleErrors.length > 0) {
        console.log(`Console errors on ${report.name}:`, consoleErrors);
      }
      
      // Filter out expected errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.message.includes('404') &&
        !error.message.includes('Failed to fetch') &&
        !error.message.includes('No data available')
      );
      
      expect(criticalErrors).toHaveLength(0);
    }
  });

  test('Verify no broken UI elements', async ({ page }) => {
    for (const report of reportPages) {
      await helpers.navigateWithDevBypass(report.path);
      await page.waitForTimeout(2000);
      
      // Check for broken images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        
        // Images should either be loading or have a natural width > 0
        if (naturalWidth === 0) {
          const src = await img.getAttribute('src');
          console.warn(`Possible broken image on ${report.name}: ${src}`);
        }
      }
      
      // Check for visible error boundaries
      const errorBoundaries = page.locator('[data-testid="error-boundary"], .error-boundary');
      const errorCount = await errorBoundaries.count();
      
      if (errorCount > 0) {
        console.error(`Error boundaries found on ${report.name}`);
      }
      
      expect(errorCount).toBe(0);
    }
  });
});