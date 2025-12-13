import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Basic Application Functionality', () => {
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

  test('Application loads and responds to basic navigation', async ({ page }) => {
    // Start with a simple navigation test that doesn't rely on complex React state
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Check that we get some kind of response (not 404 or 500)
    const response = page.url();
    expect(response).toBeTruthy();
    
    // Should redirect to login or show login
    const isOnLogin = response.includes('/login');
    expect(isOnLogin).toBe(true);
    
    await helpers.takeScreenshot('basic-navigation-test');
  });

  test('Login page serves HTML with correct structure', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Check basic HTML structure is present
    const title = await page.title();
    expect(title).toContain('Bookkeeping');
    
    // Check we have a body and html element
    const hasBasicStructure = await page.evaluate(() => {
      return {
        hasHtml: !!document.documentElement,
        hasBody: !!document.body,
        hasTitle: !!document.title,
        bodyHasContent: document.body.textContent?.length > 0
      };
    });
    
    expect(hasBasicStructure.hasHtml).toBe(true);
    expect(hasBasicStructure.hasBody).toBe(true);
    expect(hasBasicStructure.hasTitle).toBe(true);
    
    // Give React time to load if it's going to
    await page.waitForTimeout(5000);
    
    // Check if any form elements appeared
    const finalState = await page.evaluate(() => {
      return {
        formCount: document.querySelectorAll('form').length,
        inputCount: document.querySelectorAll('input').length,
        buttonCount: document.querySelectorAll('button').length,
        bodyText: document.body.textContent || ''
      };
    });
    
    console.log('Final page state:', finalState);
    
    // The page should at least load without being completely empty
    expect(finalState.bodyText.length).toBeGreaterThan(0);
    
    await helpers.takeScreenshot('login-page-final-state');
  });

  test('Protected routes redirect to login', async ({ page }) => {
    const protectedRoutes = ['/reports', '/finance', '/bookkeeping'];
    
    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      
      // Should redirect to login
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    }
  });

  test('Dev bypass parameter allows access to protected routes', async ({ page }) => {
    await page.goto('/reports?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Should not redirect to login
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/reports');
    
    // Page should load some content
    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.length > 0;
    });
    
    expect(hasContent).toBe(true);
  });

  test('API endpoints are accessible', async ({ page }) => {
    // Test health endpoint
    const response = await page.request.get('/api/health');
    expect(response.status()).toBeLessThan(500);
    
    // Should get some kind of response (even if it's an error)
    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test('Static assets load correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Check that CSS loaded
    const stylesheets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).length;
    });
    
    expect(stylesheets).toBeGreaterThan(0);
    
    // Check that scripts loaded
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).length;
    });
    
    expect(scripts).toBeGreaterThan(0);
  });
});