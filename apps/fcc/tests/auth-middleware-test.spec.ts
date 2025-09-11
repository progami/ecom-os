import { test, expect } from '@playwright/test';

test.describe('Authentication Middleware Tests', () => {
  test('dev_bypass parameter should authenticate without login', async ({ page }) => {
    // Navigate with dev_bypass
    const response = await page.goto('/?dev_bypass=true', { 
      waitUntil: 'domcontentloaded'
    });

    // Should not redirect to login
    expect(page.url()).not.toContain('/login');
    
    // Should have successful response
    expect(response?.status()).toBeLessThan(400);
    
    // Should set user_session cookie
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'user_session');
    expect(sessionCookie).toBeTruthy();
    
    // Verify session data
    if (sessionCookie) {
      // Decode URL-encoded cookie value
      const decodedValue = decodeURIComponent(sessionCookie.value);
      const sessionData = JSON.parse(decodedValue);
      expect(sessionData.user.id).toBe('user-1');
      expect(sessionData.email).toBe('ajarrar@trademanenterprise.com');
    }
  });

  test.skip('Playwright user agent should auto-enable dev bypass', async ({ page }) => {
    // Skip for now - auto-detection needs more work
    // Navigate without dev_bypass parameter
    const response = await page.goto('/', { 
      waitUntil: 'domcontentloaded'
    });

    // Should not redirect to login (auto dev bypass for Playwright)
    expect(page.url()).not.toContain('/login');
    
    // Should have successful response
    expect(response?.status()).toBeLessThan(400);
  });

  test('Protected routes should work with dev_bypass', async ({ page }) => {
    const protectedRoutes = [
      '/reports',
      '/finance',
      '/bookkeeping',
      '/analytics',
      '/cashflow'
    ];

    for (const route of protectedRoutes) {
      const response = await page.goto(`${route}?dev_bypass=true`, { 
        waitUntil: 'domcontentloaded'
      });
      
      expect(response?.status()).toBeLessThan(400);
      expect(page.url()).not.toContain('/login');
    }
  });

  test('API routes should accept dev_bypass authentication', async ({ page }) => {
    // First navigate to set up session
    await page.goto('/?dev_bypass=true');
    
    // Test API endpoint
    const response = await page.request.get('/api/v1/auth/session');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.authenticated).toBe(true);
  });

  test('CSP headers should allow scripts in development', async ({ page }) => {
    const response = await page.goto('/?dev_bypass=true');
    
    const cspHeader = response?.headers()['content-security-policy'];
    
    // In development/test, CSP should be more permissive
    if (cspHeader) {
      expect(cspHeader).toContain("'unsafe-inline'");
      expect(cspHeader).toContain("'unsafe-eval'");
    }
  });

  test('Cookies should not require secure flag in development', async ({ page }) => {
    await page.goto('/?dev_bypass=true');
    
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'user_session');
    
    // Session cookie should exist
    expect(sessionCookie).toBeTruthy();
    
    // In development, secure should be false for localhost
    expect(sessionCookie?.secure).toBe(false);
    
    // Verify cookie can be parsed
    if (sessionCookie) {
      const decodedValue = decodeURIComponent(sessionCookie.value);
      const sessionData = JSON.parse(decodedValue);
      expect(sessionData).toBeTruthy();
    }
  });
});