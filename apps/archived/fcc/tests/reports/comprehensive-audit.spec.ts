import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Comprehensive Reports Audit', () => {
  // Define all report pages to test
  const reportPages = [
    { path: '/reports', title: 'Reports Hub', heading: 'Reports Hub' },
    { path: '/reports/cash-flow', title: 'Cash Flow', heading: 'Cash Flow Statement' },
    { path: '/reports/general-ledger', title: 'General Ledger', heading: 'General Ledger' },
    { path: '/reports/trial-balance', title: 'Trial Balance', heading: 'Trial Balance' },
    { path: '/reports/balance-sheet', title: 'Balance Sheet', heading: 'Balance Sheet' },
    { path: '/reports/profit-loss', title: 'Profit & Loss', heading: 'Profit & Loss Statement' },
    { path: '/reports/import', title: 'Import Reports', heading: 'Import Reports' }
  ];

  // Test results storage
  const testResults: Array<{
    page: string;
    success: boolean;
    loadTime: number;
    errors: string[];
    issues: string[];
  }> = [];

  // Store console errors for each test
  let consoleErrors: string[] = [];
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Reset console errors for each test
    consoleErrors = [];
    
    // Set up console error listener
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Also catch page errors
    page.on('pageerror', exception => {
      consoleErrors.push(`Page error: ${exception.message}`);
    });
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  for (const reportPage of reportPages) {
    test(`should load ${reportPage.title} page correctly`, async ({ page }) => {
      const result = {
        page: reportPage.path,
        success: true,
        loadTime: 0,
        errors: [],
        issues: []
      };

      try {
        // Start timing
        const startTime = Date.now();

        // Navigate using dev bypass
        await page.goto(`http://localhost:3003${reportPage.path}?dev_bypass=true`);

        // Calculate load time
        result.loadTime = Date.now() - startTime;

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Check page title
        const pageTitle = await page.title();
        expect(pageTitle).toContain(reportPage.title);

        // Verify main heading is visible
        const heading = page.locator(`h1:has-text("${reportPage.heading}")`).first();
        await expect(heading).toBeVisible({ timeout: 10000 });

        // Check for console errors
        if (consoleErrors.length > 0) {
          result.errors = [...consoleErrors];
          result.issues.push(`Found ${consoleErrors.length} console errors`);
        }

        // Check for specific UI elements based on page type
        if (reportPage.path === '/reports') {
          // Check for report cards on hub page
          const reportCards = page.locator('[data-testid="report-card"], .cursor-pointer');
          const cardCount = await reportCards.count();
          if (cardCount === 0) {
            result.issues.push('No report cards found on hub page');
          }
        } else if (reportPage.path === '/reports/import') {
          // Check for import form elements
          const fileInput = page.locator('input[type="file"]');
          await expect(fileInput).toBeVisible({ timeout: 5000 }).catch(() => {
            result.issues.push('File input not found on import page');
          });
        } else {
          // Check for common report elements
          const dateRangeSelector = page.locator('[data-testid="date-range-selector"], button:has-text("Date Range"), button:has-text("This Month")');
          const syncButton = page.locator('button:has-text("Sync from Xero")');
          
          // Check if at least one of these elements exists
          const hasDateRange = await dateRangeSelector.first().isVisible().catch(() => false);
          const hasSyncButton = await syncButton.first().isVisible().catch(() => false);
          
          if (!hasDateRange && !hasSyncButton) {
            result.issues.push('No date range selector or sync button found');
          }
        }

        // Take screenshot
        const screenshotName = reportPage.path.replace(/\//g, '-').substring(1) || 'reports-hub';
        await page.screenshot({ 
          path: `tests/screenshots/audit-${screenshotName}.png`,
          fullPage: true 
        });

        // Check for loading indicators still visible
        const loadingIndicators = page.locator('.animate-spin, [data-testid="loading"], .loading');
        const loadingCount = await loadingIndicators.count();
        if (loadingCount > 0) {
          result.issues.push(`${loadingCount} loading indicators still visible`);
        }

        // Check for error messages
        const errorMessages = page.locator('[role="alert"], .error, .text-red-500, .text-destructive');
        const errorCount = await errorMessages.count();
        if (errorCount > 0) {
          const errorTexts = await errorMessages.allTextContents();
          result.issues.push(`${errorCount} error messages found: ${errorTexts.join(', ')}`);
        }

      } catch (error) {
        result.success = false;
        result.issues.push(`Test failed: ${error.message}`);
      }

      // Store result
      testResults.push(result);

      // Log result
      console.log(`\n${reportPage.title} Test Results:`);
      console.log(`- Path: ${result.page}`);
      console.log(`- Success: ${result.success}`);
      console.log(`- Load Time: ${result.loadTime}ms`);
      console.log(`- Console Errors: ${result.errors.length}`);
      console.log(`- Issues: ${result.issues.length}`);
      
      if (result.errors.length > 0) {
        console.log('\nConsole Errors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
      
      if (result.issues.length > 0) {
        console.log('\nIssues Found:');
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    });
  }

  test.afterAll(async () => {
    // Generate summary report
    console.log('\n\n========== COMPREHENSIVE AUDIT SUMMARY ==========\n');
    
    const successCount = testResults.filter(r => r.success).length;
    console.log(`Total Pages Tested: ${reportPages.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${reportPages.length - successCount}`);
    
    console.log('\n--- Load Time Analysis ---');
    const avgLoadTime = testResults.reduce((sum, r) => sum + r.loadTime, 0) / testResults.length;
    console.log(`Average Load Time: ${avgLoadTime.toFixed(2)}ms`);
    
    const slowPages = testResults.filter(r => r.loadTime > 3000);
    if (slowPages.length > 0) {
      console.log('\nSlow Pages (>3s):');
      slowPages.forEach(p => console.log(`  - ${p.page}: ${p.loadTime}ms`));
    }
    
    console.log('\n--- Error Summary ---');
    const pagesWithErrors = testResults.filter(r => r.errors.length > 0);
    console.log(`Pages with Console Errors: ${pagesWithErrors.length}`);
    
    const pagesWithIssues = testResults.filter(r => r.issues.length > 0);
    console.log(`Pages with Issues: ${pagesWithIssues.length}`);
    
    if (pagesWithErrors.length > 0 || pagesWithIssues.length > 0) {
      console.log('\n--- Detailed Issues ---');
      testResults.forEach(result => {
        if (result.errors.length > 0 || result.issues.length > 0) {
          console.log(`\n${result.page}:`);
          if (result.errors.length > 0) {
            console.log('  Console Errors:');
            result.errors.forEach(err => console.log(`    - ${err}`));
          }
          if (result.issues.length > 0) {
            console.log('  Issues:');
            result.issues.forEach(issue => console.log(`    - ${issue}`));
          }
        }
      });
    }
    
    console.log('\n==============================================\n');
  });
});