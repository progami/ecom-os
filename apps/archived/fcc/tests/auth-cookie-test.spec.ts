import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import { injectAuthCookies, TEST_USERS } from './utils/test-auth';

test.describe('Cookie-Based Authentication Test', () => {
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

  test('should authenticate using injected cookies', async ({ page }) => {
    // Use the new auth method
    await helpers.navigateWithAuth('/reports', 'default');

    // Should be on reports page without redirect to login
    expect(page.url()).toContain('/reports');
    expect(page.url()).not.toContain('/login');

    // Should see authenticated content
    await expect(page.locator('h1, h2').filter({ hasText: /Financial Reports/i })).toBeVisible();
  });

  test('should work with different user types', async ({ page }) => {
    // Test with no data user
    await helpers.navigateWithAuth('/reports', 'noData');

    // Should show empty state
    const emptyState = await helpers.hasEmptyState();
    expect(emptyState).toBe(true);
  });

  test('should maintain auth across navigations', async ({ page }) => {
    // Set up auth once
    await helpers.setupAuth('default');

    // Navigate to multiple pages without re-auth
    await page.goto('https://localhost:3003/reports');
    expect(page.url()).not.toContain('/login');

    await page.goto('https://localhost:3003/analytics');
    expect(page.url()).not.toContain('/login');

    await page.goto('https://localhost:3003/bookkeeping');
    expect(page.url()).not.toContain('/login');
  });

  test('comparison: dev bypass vs cookie auth', async ({ page }) => {
    console.log('Testing dev bypass method...');
    const devBypassStart = Date.now();
    await helpers.navigateWithDevBypass('/reports');
    const devBypassTime = Date.now() - devBypassStart;
    console.log(`Dev bypass navigation took: ${devBypassTime}ms`);

    console.log('Testing cookie auth method...');
    const cookieAuthStart = Date.now();
    await helpers.navigateWithAuth('/analytics', 'default');
    const cookieAuthTime = Date.now() - cookieAuthStart;
    console.log(`Cookie auth navigation took: ${cookieAuthTime}ms`);

    // Both should work
    expect(page.url()).toContain('/analytics');
  });
});