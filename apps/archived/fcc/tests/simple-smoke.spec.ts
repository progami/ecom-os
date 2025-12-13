import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Simple Smoke Tests', () => {
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

  test('Login page loads with correct title', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Check page title
    await expect(page).toHaveTitle(/Bookkeeping/i);
    
    // Wait for React to mount
    await page.waitForTimeout(2000);
    
    // Check if page has basic structure - either login form or redirect indication
    const pageHasContent = await page.evaluate(() => {
      // Check if we have the main React content - Next.js uses #__next or body > div as root
      const hasReactRoot = document.querySelector('#__next') !== null || 
                          (document.body.firstElementChild && document.body.firstElementChild.tagName === 'DIV');
      const hasForm = document.querySelector('form') !== null;
      const hasInputs = document.querySelectorAll('input').length > 0;
      const hasLoginHeading = document.querySelector('h1') !== null;
      
      return { hasReactRoot, hasForm, hasInputs, hasLoginHeading };
    });
    
    console.log('Page content check:', pageHasContent);
    
    // At minimum, the page should have React mounted or a login form
    expect(pageHasContent.hasReactRoot || pageHasContent.hasForm).toBe(true);
    
    await helpers.takeScreenshot('login-page-smoke-test');
  });

  test('Reports page loads with dev bypass', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    
    // Check page title
    await expect(page).toHaveTitle(/Bookkeeping/i);
    
    // Wait for React to mount
    await page.waitForTimeout(3000);
    
    // Check if page has content
    const pageHasContent = await page.evaluate(() => {
      const hasMain = document.querySelector('main') !== null;
      const hasContainer = document.querySelector('.container') !== null;
      const hasAnyText = document.body.textContent !== null && document.body.textContent.trim().length > 0;
      
      return { hasMain, hasContainer, hasAnyText };
    });
    
    console.log('Reports page content:', pageHasContent);
    
    // Page should have some content
    expect(pageHasContent.hasAnyText).toBe(true);
    
    await helpers.takeScreenshot('reports-page-smoke-test');
  });

  test('Dev bypass query parameter works', async ({ page }) => {
    // Navigate to protected page with dev bypass
    await page.goto('/reports?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Should not redirect to login
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/reports');
    
    await helpers.takeScreenshot('dev-bypass-works');
  });
});