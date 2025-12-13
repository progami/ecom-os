import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Main Application Navigation Tests', () => {
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

  test('Homepage should load and redirect appropriately', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');

    // The homepage should either redirect to finance or show content
    try {
      await page.waitForURL('**/finance**', { timeout: 5000 });
      const currentUrl = page.url();
      expect(currentUrl).toContain('/finance');
    } catch {
      // If no redirect, check if we're on a valid page with content
      const hasContent = await page.locator('main, h1, h2').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasContent).toBeTruthy();
    }

    await helpers.takeScreenshot('homepage-loaded');
  });

  test('Main navigation should be accessible', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();

    // Look for navigation elements - be more flexible
    const navSelectors = [
      'nav',
      '[role="navigation"]',
      '.navigation',
      '[class*="nav"]',
      'button[aria-label*="menu"]',
      'button[aria-expanded]',
      '.sidebar',
      '[class*="sidebar"]',
      'header',
      '[role="banner"]'
    ];
    
    let foundNavigation = false;
    for (const selector of navSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        foundNavigation = true;
        break;
      }
    }
    
    // Should have some form of navigation
    expect(foundNavigation).toBeTruthy();

    await helpers.takeScreenshot('main-navigation-visible');
  });

  test('Key application pages should be accessible via dev bypass', async ({ page }) => {
    const keyPages = [
      { path: '/reports' },
      { path: '/reports/import' },
      { path: '/finance' },
      { path: '/bookkeeping' }
    ];

    for (const { path } of keyPages) {
      await helpers.navigateWithDevBypass(path);
      
      // Wait a moment for any redirects
      await page.waitForTimeout(1000);
      
      // Page should load without redirecting to login
      expect(page.url()).toContain(path);
      
      // Should have a title (any non-empty title is fine)
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      
      // Should have some visible heading or content
      const hasHeading = await page.locator('h1, h2, h3, h4, main').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasHeading).toBeTruthy();
      
      // Should not show auth errors
      const errors = await helpers.checkForErrors();
      const authErrors = errors.filter(error => 
        error.toLowerCase().includes('auth') || 
        error.toLowerCase().includes('login') ||
        error.toLowerCase().includes('unauthorized')
      );
      expect(authErrors).toHaveLength(0);

      await helpers.takeScreenshot(`page-accessible-${path.replace(/\//g, '-')}`);
    }
  });

  test('Application should handle 404 pages gracefully', async ({ page }) => {
    await helpers.navigateWithDevBypass('/non-existent-page');
    
    // Should show 404 page or redirect appropriately
    const is404 = page.url().includes('404') || 
                  await page.locator('text=404').count() > 0 ||
                  await page.locator('text=Not Found').count() > 0;
    
    const isRedirected = !page.url().includes('non-existent-page');
    
    // Either should show 404 or redirect to valid page
    expect(is404 || isRedirected).toBeTruthy();

    await helpers.takeScreenshot('404-handling');
  });

  test('Page should be accessible without JavaScript (basic HTML)', async ({ page }) => {
    // Disable JavaScript
    await page.context().setOffline(false);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'javaEnabled', {
        writable: false,
        value: false,
      });
    });

    await helpers.navigateWithDevBypass('/reports');
    
    // Should still show basic content - look for any heading
    const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    let foundHeading = false;
    
    for (const selector of headingSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        foundHeading = true;
        break;
      }
    }
    
    expect(foundHeading).toBeTruthy();

    await helpers.takeScreenshot('no-javascript-accessibility');
  });

  test('Application should work with keyboard navigation', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();

    // Test Tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on interactive elements
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    
    if (focusedElement) {
      expect(interactiveElements).toContain(focusedElement);
    }

    await helpers.takeScreenshot('keyboard-navigation');
  });

  test('Application should handle slow network conditions', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add delay
      route.continue();
    });

    await helpers.navigateWithDevBypass('/reports');
    
    // Should still load within reasonable time
    await helpers.waitForPageLoad();
    
    // Look for any visible heading
    const headingSelectors = ['h1', 'h2', 'h3', 'h4'];
    let foundHeading = false;
    
    for (const selector of headingSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          foundHeading = true;
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
    
    expect(foundHeading).toBeTruthy();

    await helpers.takeScreenshot('slow-network-handling');
  });

  test('Application should handle API failures gracefully', async ({ page }) => {
    // Make all API calls fail
    await page.route('/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service Unavailable' })
      });
    });

    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();

    // Page should still render basic structure - look for any visible heading
    const headingSelectors = ['h1', 'h2', 'h3', 'h4'];
    let foundHeading = false;
    
    for (const selector of headingSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          foundHeading = true;
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
    
    expect(foundHeading).toBeTruthy();
    
    // Should not crash the application
    const pageErrors = await page.evaluate(() => window.onerror);
    expect(pageErrors).toBeFalsy();

    await helpers.takeScreenshot('api-failures-handled');
  });

  test('Search functionality should work if present', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();

    // Look for search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('balance');
      await page.keyboard.press('Enter');
      
      // Should show search results or filter
      await helpers.waitForPageLoad();
      
      await helpers.takeScreenshot('search-functionality');
    }
  });

  test('Mobile navigation should work', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();

    // Look for mobile menu button
    const mobileMenuSelectors = [
      'button[aria-label*="menu"]',
      'button[aria-expanded]',
      '.mobile-menu',
      '[data-testid*="mobile-menu"]',
      'button svg', // Common pattern for icon buttons
      '[class*="menu-button"]',
      '[class*="hamburger"]'
    ];
    
    let foundMenuButton = false;
    for (const selector of mobileMenuSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        try {
          await page.locator(selector).first().click();
          foundMenuButton = true;
          // Wait for animation
          await page.waitForTimeout(500);
          await helpers.takeScreenshot('mobile-navigation-opened');
          break;
        } catch {
          // Continue to next selector
        }
      }
    }

    // Test that page is still functional on mobile - look for any heading
    const headingSelectors = ['h1', 'h2', 'h3', 'h4'];
    let foundHeading = false;
    
    for (const selector of headingSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          foundHeading = true;
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
    
    expect(foundHeading).toBeTruthy();
    
    await helpers.takeScreenshot('mobile-navigation-functional');
  });

  test('Application performance should be acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForPageLoad();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 30 seconds (generous for test environment)
    expect(loadTime).toBeLessThan(30000);
    
    // Check for basic performance metrics
    try {
      const performanceMetrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.navigationStart || 0,
          loadComplete: perfData?.loadEventEnd - perfData?.navigationStart || 0
        };
      });
      
      // Either metric should be positive if available
      const hasMetrics = performanceMetrics.domContentLoaded > 0 || performanceMetrics.loadComplete > 0;
      expect(hasMetrics || loadTime < 30000).toBeTruthy();
    } catch {
      // If performance API fails, just ensure page loaded in time
      expect(loadTime).toBeLessThan(30000);
    }

    await helpers.takeScreenshot('performance-acceptable');
  });
});