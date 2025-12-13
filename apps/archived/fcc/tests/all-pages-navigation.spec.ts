import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('All Pages Navigation Test', () => {
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
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  const allPages = [
    // Main pages
    { path: '/', name: 'Homepage' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/finance', name: 'Finance' },
    { path: '/cashflow', name: 'Cashflow' },
    
    // Bookkeeping pages
    { path: '/bookkeeping', name: 'Bookkeeping' },
    { path: '/bookkeeping/chart-of-accounts', name: 'Chart of Accounts' },
    { path: '/bookkeeping/sop-generator', name: 'SOP Generator' },
    { path: '/bookkeeping/sop-tables', name: 'SOP Tables' },
    
    // Reports pages
    { path: '/reports', name: 'Reports Hub' },
    { path: '/reports/import', name: 'Import Reports' },
    { path: '/reports/cash-flow', name: 'Cash Flow Report' },
    { path: '/reports/trial-balance', name: 'Trial Balance' },
    { path: '/reports/general-ledger', name: 'General Ledger' },
    { path: '/reports/balance-sheet', name: 'Balance Sheet' },
    { path: '/reports/profit-loss', name: 'Profit & Loss' },
    { path: '/reports/comparison-demo', name: 'Comparison Demo' },
    
    // Other pages
    { path: '/setup', name: 'Setup' },
    { path: '/login', name: 'Login' },
    { path: '/register', name: 'Register' }
  ];

  test('Navigate through ALL pages and check for errors', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for full test
    
    const results = [];
    
    for (const pageInfo of allPages) {
      console.log(`Testing ${pageInfo.name} at ${pageInfo.path}...`);
      
      try {
        // Clear any previous errors
        helpers.clearRuntimeErrors();
        
        // Navigate to the page
        await helpers.navigateWithDevBypass(pageInfo.path);
        
        // Wait for page to stabilize
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        
        // Check page loaded successfully
        const title = await page.title();
        const url = page.url();
        
        // Check for visible content
        const hasContent = await page.locator('main, h1, h2, [role="main"]').first().isVisible({ timeout: 5000 }).catch(() => false);
        
        // Check for errors
        const errors = helpers.getRuntimeErrors();
        const criticalErrors = errors.filter(error => 
          !error.message.includes('404') &&
          !error.message.includes('No data available') &&
          !error.message.includes('Failed to fetch') &&
          !error.message.includes('Warning:')
        );
        
        // Check for "undefined" or "null" in visible text
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const hasUndefined = bodyText.includes('undefined') && !bodyText.includes('undefined behavior');
        const hasNull = bodyText.includes('null') && !bodyText.includes('nullable');
        
        results.push({
          page: pageInfo.name,
          path: pageInfo.path,
          url: url,
          title: title,
          loaded: true,
          hasContent: hasContent,
          criticalErrors: criticalErrors.length,
          hasUndefined: hasUndefined,
          hasNull: hasNull,
          status: criticalErrors.length === 0 && hasContent && !hasUndefined && !hasNull ? 'PASS' : 'FAIL'
        });
        
      } catch (error) {
        results.push({
          page: pageInfo.name,
          path: pageInfo.path,
          loaded: false,
          error: error.message,
          status: 'ERROR'
        });
      }
    }
    
    // Print summary
    console.log('\n=== ALL PAGES TEST SUMMARY ===\n');
    console.log(`Total pages tested: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.status === 'PASS').length}`);
    console.log(`Failed: ${results.filter(r => r.status === 'FAIL').length}`);
    console.log(`Errors: ${results.filter(r => r.status === 'ERROR').length}`);
    
    console.log('\n=== DETAILED RESULTS ===\n');
    for (const result of results) {
      const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
      console.log(`${icon} ${result.page} (${result.path})`);
      if (result.status !== 'PASS') {
        if (!result.loaded) {
          console.log(`   Error: ${result.error}`);
        } else {
          if (result.criticalErrors > 0) console.log(`   Critical errors: ${result.criticalErrors}`);
          if (!result.hasContent) console.log(`   No visible content`);
          if (result.hasUndefined) console.log(`   Contains "undefined"`);
          if (result.hasNull) console.log(`   Contains "null"`);
        }
      }
    }
    
    // Test should pass if all pages load without critical errors
    const failedPages = results.filter(r => r.status !== 'PASS');
    if (failedPages.length > 0) {
      console.log(`\n${failedPages.length} pages failed the test`);
    }
    
    expect(failedPages).toHaveLength(0);
  });

  test('Quick smoke test - key pages only', async ({ page }) => {
    const keyPages = [
      { path: '/reports', name: 'Reports Hub' },
      { path: '/finance', name: 'Finance' },
      { path: '/bookkeeping', name: 'Bookkeeping' },
      { path: '/reports/balance-sheet', name: 'Balance Sheet' }
    ];
    
    for (const pageInfo of keyPages) {
      await helpers.navigateWithDevBypass(pageInfo.path);
      await page.waitForLoadState('domcontentloaded');
      
      // Page should not redirect to login
      expect(page.url()).toContain(pageInfo.path);
      
      // Should have visible content
      const hasContent = await page.locator('main, h1, h2').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasContent).toBeTruthy();
      
      // No critical errors
      const errors = helpers.getRuntimeErrors();
      expect(errors.filter(e => !e.message.includes('404'))).toHaveLength(0);
    }
  });
});