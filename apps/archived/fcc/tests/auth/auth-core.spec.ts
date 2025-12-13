import { test, expect } from '@playwright/test';

test.describe('Core Authentication Tests', () => {
  test('Cookie authentication should work', async ({ page, context }) => {
    // Set authentication cookie
    await context.addCookies([{
      name: 'user_session',
      value: JSON.stringify({
        user: {
          id: 'user-1',
          email: 'ajarrar@trademanenterprise.com',
          name: 'TRADEMAN ENTERPRISE'
        },
        userId: 'user-1',
        email: 'ajarrar@trademanenterprise.com',
        tenantId: '!Qn7M1',
        tenantName: 'TRADEMAN ENTERPRISE LTD'
      }),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const
    }]);
    
    // Navigate to protected page with cookie
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    
    // Should not be redirected to login
    expect(page.url()).not.toContain('/login');
    expect(page.url()).toContain('/reports');
  });

  test('Protected pages should redirect to login without auth', async ({ page }) => {
    // Navigate to protected page without authentication
    const response = await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    
    // Should redirect to login page
    expect(page.url()).toContain('/login');
  });

  test('Login form should handle errors gracefully', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Try login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/v1/auth/login')
    );
    
    await page.click('button[type="submit"]');
    const response = await responsePromise;
    
    // Should get 401 error
    expect(response.status()).toBe(401);
    
    // Wait for error message
    await page.waitForSelector('.bg-red-500\\/10', { timeout: 5000 });
    
    // Check error message is visible
    const errorElement = page.locator('.bg-red-500\\/10').first();
    await expect(errorElement).toBeVisible();
    
    // Verify error text
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('Invalid credentials');
    
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });
});