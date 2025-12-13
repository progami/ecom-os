import { test, expect } from '@playwright/test';
import { loginAsTestUser, TestHelpers } from '../utils/test-helpers';

test.describe('Comprehensive Reports Audit - Simple', () => {
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
  const results: any[] = [];
  let helpers: TestHelpers;

  test.beforeAll(async ({ browser }) => {
    console.log('\n=== Starting Comprehensive Reports Audit ===\n');
  });

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Login before each test
    await loginAsTestUser(page);
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
    test(`${reportPage.title} - Load and Verify`, async ({ page }) => {
      const startTime = Date.now();
      let success = true;
      const issues: string[] = [];
      const consoleErrors: string[] = [];

      // Set up console error listener
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', exception => {
        consoleErrors.push(`Page error: ${exception.message}`);
      });

      try {
        // Navigate to the report page
        await page.goto(reportPage.path, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        // Wait for page to stabilize
        await page.waitForTimeout(1000);

        // Check page title
        const pageTitle = await page.title();
        if (!pageTitle.includes(reportPage.title)) {
          issues.push(`Page title mismatch: expected "${reportPage.title}", got "${pageTitle}"`);
        }

        // Try to find the main heading
        const headingLocators = [
          page.locator(`h1:has-text("${reportPage.heading}")`),
          page.locator(`h2:has-text("${reportPage.heading}")`),
          page.locator(`[role="heading"]:has-text("${reportPage.heading}")`)
        ];

        let headingFound = false;
        for (const locator of headingLocators) {
          const count = await locator.count();
          if (count > 0) {
            headingFound = true;
            break;
          }
        }

        if (!headingFound) {
          issues.push(`Main heading "${reportPage.heading}" not found`);
        }

        // Check for loading indicators that shouldn't be visible
        const loadingIndicators = await page.locator('.animate-spin, .loading').count();
        if (loadingIndicators > 0) {
          issues.push(`${loadingIndicators} loading indicators still visible`);
        }

        // Check for error messages
        const errorSelectors = [
          '[role="alert"]',
          '.error-message',
          '.text-red-500',
          '.text-destructive'
        ];

        for (const selector of errorSelectors) {
          const errorElements = await page.locator(selector).count();
          if (errorElements > 0) {
            const texts = await page.locator(selector).allTextContents();
            const nonEmptyTexts = texts.filter(t => t.trim().length > 0);
            if (nonEmptyTexts.length > 0) {
              issues.push(`Error messages found: ${nonEmptyTexts.join(', ')}`);
            }
          }
        }

        // Page-specific checks
        if (reportPage.path === '/reports') {
          // Check for report cards
          const cards = await page.locator('.grid a[href^="/reports/"], .grid button').count();
          if (cards === 0) {
            issues.push('No report cards found on hub page');
          } else {
            console.log(`  ✓ Found ${cards} report cards`);
          }
        } else if (reportPage.path === '/reports/import') {
          // Check for import elements
          const hasFileInput = await page.locator('input[type="file"]').count() > 0;
          const hasUploadButton = await page.locator('button:has-text("Upload"), button:has-text("Import")').count() > 0;
          
          if (!hasFileInput) issues.push('No file input found');
          if (!hasUploadButton) issues.push('No upload/import button found');
        } else {
          // Check for common report elements
          const hasDateFilter = await page.locator('button:has-text("Date"), button:has-text("Month"), select').count() > 0;
          const hasSyncButton = await page.locator('button:has-text("Sync")').count() > 0;
          const hasExportButton = await page.locator('button:has-text("Export"), button:has-text("Download")').count() > 0;
          
          if (!hasDateFilter && !hasSyncButton && !hasExportButton) {
            issues.push('No report controls found (date filter, sync, or export)');
          }
        }

        // Take screenshot
        const screenshotPath = `tests/screenshots/audit-${reportPage.path.replace(/\//g, '-').substring(1) || 'hub'}.png`;
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });

      } catch (error: any) {
        success = false;
        issues.push(`Test failed: ${error.message}`);
      }

      const loadTime = Date.now() - startTime;

      // Store results
      results.push({
        page: reportPage.path,
        title: reportPage.title,
        success,
        loadTime,
        consoleErrors,
        issues
      });

      // Log results
      console.log(`\n${reportPage.title}:`);
      console.log(`  Path: ${reportPage.path}`);
      console.log(`  Status: ${success ? '✓ PASSED' : '✗ FAILED'}`);
      console.log(`  Load Time: ${loadTime}ms`);
      
      if (consoleErrors.length > 0) {
        console.log(`  Console Errors (${consoleErrors.length}):`);
        consoleErrors.forEach(err => console.log(`    - ${err}`));
      }
      
      if (issues.length > 0) {
        console.log(`  Issues (${issues.length}):`);
        issues.forEach(issue => console.log(`    - ${issue}`));
      }

      // Assert that there are no critical issues
      expect(success, `Page ${reportPage.path} should load successfully`).toBe(true);
      expect(consoleErrors.length, `Page ${reportPage.path} should have no console errors`).toBe(0);
    });
  }

  test.afterAll(async () => {
    console.log('\n\n========== AUDIT SUMMARY ==========\n');
    
    const totalPages = results.length;
    const successfulPages = results.filter(r => r.success).length;
    const failedPages = results.filter(r => !r.success).length;
    const pagesWithErrors = results.filter(r => r.consoleErrors.length > 0).length;
    const pagesWithIssues = results.filter(r => r.issues.length > 0).length;
    
    console.log(`Total Pages Tested: ${totalPages}`);
    console.log(`✓ Successful: ${successfulPages}`);
    console.log(`✗ Failed: ${failedPages}`);
    console.log(`⚠ Pages with Console Errors: ${pagesWithErrors}`);
    console.log(`⚠ Pages with Issues: ${pagesWithIssues}`);
    
    // Load time analysis
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / totalPages;
    const slowestPage = results.reduce((max, r) => r.loadTime > max.loadTime ? r : max, results[0]);
    const fastestPage = results.reduce((min, r) => r.loadTime < min.loadTime ? r : min, results[0]);
    
    console.log('\n--- Performance ---');
    console.log(`Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
    console.log(`Fastest: ${fastestPage.title} (${fastestPage.loadTime}ms)`);
    console.log(`Slowest: ${slowestPage.title} (${slowestPage.loadTime}ms)`);
    
    // List problematic pages
    if (failedPages > 0 || pagesWithErrors > 0 || pagesWithIssues > 0) {
      console.log('\n--- Problematic Pages ---');
      
      results.forEach(result => {
        if (!result.success || result.consoleErrors.length > 0 || result.issues.length > 0) {
          console.log(`\n${result.title} (${result.page}):`);
          
          if (!result.success) {
            console.log('  Status: FAILED');
          }
          
          if (result.consoleErrors.length > 0) {
            console.log(`  Console Errors: ${result.consoleErrors.length}`);
            result.consoleErrors.slice(0, 3).forEach(err => 
              console.log(`    - ${err.substring(0, 100)}${err.length > 100 ? '...' : ''}`)
            );
          }
          
          if (result.issues.length > 0) {
            console.log(`  Issues: ${result.issues.length}`);
            result.issues.forEach(issue => console.log(`    - ${issue}`));
          }
        }
      });
    }
    
    console.log('\n===================================\n');
    
    // Overall health check
    const healthScore = (successfulPages / totalPages) * 100;
    console.log(`Overall Health Score: ${healthScore.toFixed(0)}%`);
    
    if (healthScore === 100) {
      console.log('✅ All report pages are working perfectly!');
    } else if (healthScore >= 80) {
      console.log('⚠️  Most report pages are working, but some need attention.');
    } else {
      console.log('❌ Multiple report pages have issues that need to be fixed.');
    }
  });
});