import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Simple Playwright Setup Test', () => {
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
  test('Playwright should be able to navigate to a page', async ({ page }) => {
    // Test navigation to the app with dev bypass
    await page.goto('/reports?dev_bypass=true', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Basic check that page loaded
    await expect(page).toHaveTitle(/.*/); // Any title is fine
    
    // Verify not redirected to login
    expect(page.url()).not.toContain('/login');
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/simple-test.png', fullPage: true });
    
    console.log('✅ Playwright setup is working! Page loaded successfully.');
  });

  test('Playwright should handle HTTPS errors correctly', async ({ page }) => {
    // Test that HTTPS errors are being ignored
    const response = await page.goto('/?dev_bypass=true', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Response should exist (even if error)
    expect(response).toBeTruthy();
    
    // Verify authentication worked
    expect(page.url()).not.toContain('/login');
    
    console.log('✅ HTTPS error handling is working correctly.');
  });
});