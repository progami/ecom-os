import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Reports Pages Comprehensive Audit', () => {
  const reportPages = [
    { path: '/reports', title: 'Reports Hub', heading: 'Reports Hub' },
    { path: '/reports/cash-flow', title: 'Cash Flow', heading: 'Cash Flow Statement' },
    { path: '/reports/general-ledger', title: 'General Ledger', heading: 'General Ledger' },
    { path: '/reports/trial-balance', title: 'Trial Balance', heading: 'Trial Balance' },
    { path: '/reports/balance-sheet', title: 'Balance Sheet', heading: 'Balance Sheet' },
    { path: '/reports/profit-loss', title: 'Profit & Loss', heading: 'Profit & Loss Statement' },
    { path: '/reports/import', title: 'Import Reports', heading: 'Import Reports' }
  ];

  const results: any[] = [];
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
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
    test(`${reportPage.title}`, async ({ page }) => {
      const startTime = Date.now();
      const issues: string[] = [];
      const consoleErrors: string[] = [];
      
      // Track console errors but don't fail test
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out expected errors (no data available is expected)
          if (!text.includes('No') || !text.includes('data available')) {
            consoleErrors.push(text);
          }
        }
      });

      // Navigate with dev bypass
      await helpers.navigateWithDevBypass(reportPage.path);
      
      // Wait for page to stabilize
      await page.waitForTimeout(2000);
      
      // Check page loaded
      const currentUrl = page.url();
      expect(currentUrl).toContain(reportPage.path);
      
      // Check for heading
      const headingFound = await page.locator(`h1, h2`).filter({ hasText: new RegExp(reportPage.heading) }).count() > 0 ||
                          await page.locator(`h1, h2`).filter({ hasText: new RegExp(reportPage.title) }).count() > 0;
      
      if (!headingFound) {
        issues.push('Main heading not found');
      }
      
      // Page-specific checks
      if (reportPage.path === '/reports') {
        const hasReportLinks = await page.locator('a[href^="/reports/"]').count() > 0;
        if (!hasReportLinks) {
          issues.push('No report links found');
        }
      } else if (reportPage.path === '/reports/import') {
        const hasImportControls = await page.locator('input[type="file"], button').count() > 0;
        if (!hasImportControls) {
          issues.push('No import controls found');
        }
      } else {
        // Check for empty state or data
        const hasEmptyState = await page.locator('text=/no data|sync.*xero/i').count() > 0;
        const hasData = await page.locator('table, .chart, [class*="metric"]').count() > 0;
        
        if (!hasEmptyState && !hasData) {
          issues.push('No data or empty state found');
        }
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: `tests/screenshots/audit-${reportPage.path.replace(/\//g, '-').substring(1) || 'hub'}.png`,
        fullPage: true 
      });
      
      const loadTime = Date.now() - startTime;
      
      // Store result
      results.push({
        page: reportPage.path,
        title: reportPage.title,
        loadTime,
        issues,
        consoleErrors: consoleErrors.length,
        passed: issues.length === 0
      });
      
      // Log results
      console.log(`\n${reportPage.title}:`);
      console.log(`  Load time: ${loadTime}ms`);
      console.log(`  Status: ${issues.length === 0 ? '✓ PASSED' : '⚠ ISSUES FOUND'}`);
      if (issues.length > 0) {
        console.log(`  Issues: ${issues.join(', ')}`);
      }
      if (consoleErrors.length > 0) {
        console.log(`  Console errors: ${consoleErrors.length}`);
      }
    });
  }
  
  test.afterAll(async () => {
    console.log('\n\n========== AUDIT SUMMARY ==========');
    console.log(`Total pages tested: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.passed).length}`);
    console.log(`With issues: ${results.filter(r => !r.passed).length}`);
    
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    console.log(`\nAverage load time: ${avgLoadTime.toFixed(0)}ms`);
    
    console.log('\nDetailed Results:');
    results.forEach(r => {
      console.log(`\n${r.title}:`);
      console.log(`  Path: ${r.page}`);
      console.log(`  Load time: ${r.loadTime}ms`);
      console.log(`  Status: ${r.passed ? '✓' : '✗'}`);
      if (r.issues.length > 0) {
        console.log(`  Issues: ${r.issues.join(', ')}`);
      }
      if (r.consoleErrors > 0) {
        console.log(`  Console errors: ${r.consoleErrors}`);
      }
    });
    
    console.log('\n===================================');
  });
});