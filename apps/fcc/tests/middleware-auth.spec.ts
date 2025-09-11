import { test, expect } from '@playwright/test';

test.describe('Middleware Authentication Tests', () => {
  test('Cookie authentication should bypass login', async ({ page, context }) => {
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
    
    // Navigate to reports page (protected route)
    await page.goto('/reports');
    
    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    
    // Should be on reports page
    await expect(page).toHaveURL(/\/reports/);
    
    // Page should load (wait for content to appear)
    await page.waitForTimeout(2000); // Give page time to render
  });

  test('API session endpoint should recognize cookie auth', async ({ page, context }) => {
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
    
    // Make API request
    const response = await page.request.get('/api/v1/auth/session');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.userId).toBe('test-user-1');
    expect(data.user.email).toBe('test@example.com');
  });

  test('Without cookie should redirect to login', async ({ page, context }) => {
    // Clear any existing cookies
    await context.clearCookies();
    
    // Navigate to protected route
    await page.goto('/reports');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('Dev bypass parameter should still work', async ({ page }) => {
    // Navigate with dev bypass
    await page.goto('/reports?dev_bypass=true');
    
    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    
    // Should be on reports page with dev_bypass
    await expect(page).toHaveURL(/\/reports.*dev_bypass=true/);
  });
});