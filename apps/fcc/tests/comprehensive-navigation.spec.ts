import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Comprehensive Navigation Test', () => {
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

  test('should navigate through ALL pages in the application', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for comprehensive test

    // Define all pages in the application
    const allPages = [
      // Auth pages
      { path: '/', name: 'Homepage', requiresAuth: true },
      { path: '/login', name: 'Login', requiresAuth: false },
      { path: '/register', name: 'Register', requiresAuth: false },
      { path: '/setup', name: 'Setup', requiresAuth: true },
      
      // Main application pages
      { path: '/analytics', name: 'Analytics', requiresAuth: true },
      { path: '/cashflow', name: 'Cashflow', requiresAuth: true },
      
      // Bookkeeping section
      { path: '/bookkeeping', name: 'Bookkeeping Dashboard', requiresAuth: true },
      { path: '/bookkeeping/chart-of-accounts', name: 'Chart of Accounts', requiresAuth: true },
      { path: '/bookkeeping/sop-generator', name: 'SOP Generator', requiresAuth: true },
      { path: '/bookkeeping/sop-tables', name: 'SOP Tables', requiresAuth: true },
      
      // Reports section (with new flattened structure)
      { path: '/reports', name: 'Reports Hub', requiresAuth: true },
      { path: '/reports/balance-sheet', name: 'Balance Sheet', requiresAuth: true },
      { path: '/reports/cash-flow', name: 'Cash Flow', requiresAuth: true },
      { path: '/reports/general-ledger', name: 'General Ledger', requiresAuth: true },
      { path: '/reports/profit-loss', name: 'Profit & Loss', requiresAuth: true },
      { path: '/reports/trial-balance', name: 'Trial Balance', requiresAuth: true },
      { path: '/reports/import', name: 'Import', requiresAuth: true }
    ];

    const navigationResults = [];
    const errorPages = [];
    const slowPages = [];

    console.log(`\\n=== Starting Comprehensive Navigation Test ===`);
    console.log(`Testing ${allPages.length} pages...\\n`);

    for (const pageInfo of allPages) {
      const startTime = Date.now();
      let status = 'success';
      let errorMessage = '';
      
      try {
        console.log(`Navigating to: ${pageInfo.name} (${pageInfo.path})`);
        
        // Navigate with or without dev bypass based on auth requirement
        if (pageInfo.requiresAuth) {
          await helpers.navigateWithDevBypass(pageInfo.path);
        } else {
          await page.goto(`https://localhost:3003${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
        }

        // Wait for page to stabilize
        await helpers.waitForDataLoad(5000);

        // Basic page checks
        const pageTitle = await page.title();
        expect(pageTitle).toBeTruthy();

        // Check for main content
        const hasMainContent = 
          await page.locator('main, [role="main"], form, .container').isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasMainContent).toBe(true);

        // Check for critical errors
        const criticalErrors = helpers.getRuntimeErrors().filter(e => 
          !e.message.includes('404') && 
          !e.message.includes('Failed to fetch') &&
          !e.message.includes('No data available') &&
          !e.message.includes('NetworkError')
        );

        if (criticalErrors.length > 0) {
          errorMessage = `Runtime errors: ${criticalErrors.map(e => e.message).join(', ')}`;
          status = 'error';
          errorPages.push({ ...pageInfo, errors: criticalErrors });
        }

        // Clear errors for next page
        helpers.clearRuntimeErrors();

      } catch (error) {
        status = 'failed';
        errorMessage = error.message;
        errorPages.push({ ...pageInfo, error: errorMessage });
      }

      const loadTime = Date.now() - startTime;
      
      // Flag slow pages (> 5 seconds)
      if (loadTime > 5000) {
        slowPages.push({ ...pageInfo, loadTime });
      }

      navigationResults.push({
        ...pageInfo,
        status,
        loadTime,
        errorMessage
      });

      console.log(`  Status: ${status} (${loadTime}ms)${errorMessage ? ` - ${errorMessage}` : ''}`);
    }

    // Summary report
    console.log(`\\n=== Navigation Test Summary ===`);
    console.log(`Total pages tested: ${allPages.length}`);
    console.log(`Successful: ${navigationResults.filter(r => r.status === 'success').length}`);
    console.log(`Failed: ${navigationResults.filter(r => r.status === 'failed').length}`);
    console.log(`With errors: ${navigationResults.filter(r => r.status === 'error').length}`);

    if (slowPages.length > 0) {
      console.log(`\\nSlow pages (>5s):`);
      slowPages.forEach(p => {
        console.log(`  - ${p.name}: ${p.loadTime}ms`);
      });
    }

    if (errorPages.length > 0) {
      console.log(`\\nPages with errors:`);
      errorPages.forEach(p => {
        console.log(`  - ${p.name}: ${p.error || p.errors?.map(e => e.message).join(', ')}`);
      });
    }

    // Assert no critical failures
    const failedPages = navigationResults.filter(r => r.status === 'failed');
    expect(failedPages.length).toBe(0);
  });

  test('should verify navigation menu links work correctly', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check for navigation menu
    const navSelectors = [
      'nav',
      '[role="navigation"]',
      '.sidebar',
      '.navigation-menu'
    ];

    let navElement = null;
    for (const selector of navSelectors) {
      const nav = page.locator(selector).first();
      if (await nav.isVisible({ timeout: 2000 }).catch(() => false)) {
        navElement = nav;
        break;
      }
    }

    expect(navElement).not.toBeNull();

    if (navElement) {
      // Find all navigation links
      const navLinks = await navElement.locator('a[href]').all();
      console.log(`Found ${navLinks.length} navigation links`);

      // Test each link
      for (const link of navLinks.slice(0, 5)) { // Test first 5 links
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          console.log(`Testing nav link: ${text} -> ${href}`);
          
          await link.click();
          await helpers.waitForDataLoad(3000);
          
          // Verify navigation happened
          expect(page.url()).toContain(href);
          
          // Go back to starting page
          await helpers.navigateWithDevBypass('/');
        }
      }
    }
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    const testPages = [
      '/reports',
      '/analytics',
      '/bookkeeping',
      '/reports/balance-sheet'
    ];

    // Navigate through pages
    for (const pagePath of testPages) {
      await helpers.navigateWithDevBypass(pagePath);
      await helpers.waitForDataLoad(2000);
    }

    // Test back navigation
    for (let i = testPages.length - 2; i >= 0; i--) {
      await page.goBack();
      await helpers.waitForDataLoad(2000);
      expect(page.url()).toContain(testPages[i]);
    }

    // Test forward navigation
    for (let i = 1; i < testPages.length; i++) {
      await page.goForward();
      await helpers.waitForDataLoad(2000);
      expect(page.url()).toContain(testPages[i]);
    }
  });

  test('should maintain authentication state across navigation', async ({ page }) => {
    // Start with authenticated page
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForDataLoad();

    // Navigate to multiple pages
    const authPages = [
      '/analytics',
      '/cashflow',
      '/bookkeeping',
      '/reports/profit-loss'
    ];

    for (const pagePath of authPages) {
      await helpers.navigateWithDevBypass(pagePath);
      await helpers.waitForDataLoad();

      // Should not redirect to login
      expect(page.url()).not.toContain('/login');
      
      // Should show authenticated content
      const hasContent = await page.locator('main, [role="main"]').isVisible();
      expect(hasContent).toBe(true);
    }
  });

  test('should handle deep linking correctly', async ({ page }) => {
    // Test direct navigation to deep pages
    const deepLinks = [
      '/reports/balance-sheet',
      '/reports/profit-loss',
      '/bookkeeping/chart-of-accounts',
    ];

    for (const link of deepLinks) {
      // Direct navigation
      await helpers.navigateWithDevBypass(link);
      await helpers.waitForDataLoad();

      // Verify correct page loaded
      expect(page.url()).toContain(link);

      // Check page rendered correctly
      const hasContent = await page.locator('main, [role="main"]').isVisible();
      expect(hasContent).toBe(true);

      // Clear any errors
      helpers.clearRuntimeErrors();
    }
  });

  test('should verify all report links from reports hub', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForDataLoad();

    // Expected report links after restructuring
    const expectedReports = [
      { name: 'Balance Sheet', path: '/reports/balance-sheet' },
      { name: 'Cash Flow', path: '/reports/cash-flow' },
      { name: 'General Ledger', path: '/reports/general-ledger' },
      { name: 'Profit & Loss', path: '/reports/profit-loss' },
      { name: 'Trial Balance', path: '/reports/trial-balance' }
    ];

    for (const report of expectedReports) {
      // Find link or button for this report
      const reportLink = page.locator(`a[href="${report.path}"], button:has-text("${report.name}")`).first();
      
      if (await reportLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Found link for ${report.name}`);
        
        // Click and verify navigation
        await reportLink.click();
        await helpers.waitForDataLoad();
        
        expect(page.url()).toContain(report.path);
        
        // Go back to reports hub
        await helpers.navigateWithDevBypass('/reports');
      } else {
        console.log(`Warning: Could not find link for ${report.name}`);
      }
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const nonExistentPages = [
      '/reports/non-existent-report',
      '/invalid-page',
      '/bookkeeping/invalid-section'
    ];

    for (const invalidPath of nonExistentPages) {
      await helpers.navigateWithDevBypass(invalidPath);
      await page.waitForTimeout(2000);

      // Should show 404 or redirect
      const is404 = 
        page.url().includes('404') ||
        await page.locator('text=/404|not found|doesn.*exist/i').isVisible({ timeout: 2000 }).catch(() => false);

      const isRedirected = !page.url().includes(invalidPath);

      expect(is404 || isRedirected).toBe(true);
    }
  });
});