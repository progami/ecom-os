import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Cookie Authentication Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page, context }) => {
    helpers = new TestHelpers(page);
    
    // Set up test user session cookie
    const testSession = {
      user: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User'
      },
      userId: 'test-user-1',
      email: 'test@example.com',
      tenantId: '!Qn7M1',
      tenantName: 'Test Tenant'
    };
    
    await context.addCookies([{
      name: 'user_session',
      value: JSON.stringify(testSession),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
  });

  test('Cookie authentication should work without dev_bypass', async ({ page }) => {
    // Navigate to a protected route without dev_bypass
    await page.goto('/bookkeeping');
    
    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    
    // Should see the bookkeeping page
    await expect(page).toHaveURL('/bookkeeping');
    
    // Page should contain expected elements (adjust based on your actual page)
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('API routes should accept cookie authentication', async ({ page, context }) => {
    // Make an API request that requires authentication
    const response = await page.request.get('/api/v1/auth/session');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.userId).toBe('test-user-1');
    expect(data.user.email).toBe('test@example.com');
  });

  test('Admin cookie authentication should work', async ({ page, context }) => {
    // Clear existing cookies first
    await context.clearCookies();
    
    // Set up admin user session cookie
    const adminSession = {
      user: {
        id: 'test-admin-1',
        email: 'admin@example.com',
        name: 'Test Admin'
      },
      userId: 'test-admin-1',
      email: 'admin@example.com',
      tenantId: '!Qn7M1',
      tenantName: 'Test Tenant',
      isAdmin: true
    };
    
    await context.addCookies([{
      name: 'user_session',
      value: JSON.stringify(adminSession),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
    
    // Navigate to a page
    await page.goto('/reports');
    
    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    
    // Make an API request to verify admin status
    const response = await page.request.get('/api/v1/auth/session');
    const data = await response.json();
    
    expect(data.authenticated).toBe(true);
    expect(data.user.userId).toBe('test-admin-1');
    expect(data.user.isAdmin).toBe(true);
  });

  test('Invalid cookie should redirect to login', async ({ page, context }) => {
    // Clear cookies and set an invalid one
    await context.clearCookies();
    
    await context.addCookies([{
      name: 'user_session',
      value: 'invalid-json',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
    
    // Navigate to a protected route
    await page.goto('/bookkeeping');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});