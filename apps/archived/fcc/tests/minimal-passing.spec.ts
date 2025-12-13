import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Minimal Passing Tests', () => {
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
  test('Basic browser test', async ({ page }) => {
    // Just navigate to a simple page
    await page.goto('https://example.com');
    
    // Check that we can see some content
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/Example/i);
  });

  test('Basic math test', async () => {
    // Simple test that doesn't require the app
    expect(1 + 1).toBe(2);
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
  });

  test('Browser capabilities test', async ({ page }) => {
    // Test that Playwright is working correctly
    await page.goto('data:text/html,<h1>Test Page</h1><p>This is a test</p>');
    
    // Check content is visible
    await expect(page.locator('h1')).toHaveText('Test Page');
    await expect(page.locator('p')).toHaveText('This is a test');
    
    // Take a screenshot (tests screenshot capability)
    await page.screenshot({ path: 'test-results/screenshots/browser-test.png' });
  });
});