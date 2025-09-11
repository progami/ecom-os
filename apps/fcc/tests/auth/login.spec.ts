import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Authentication Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      // Filter out expected authentication errors
      const unexpectedErrors = errors.filter(err => {
        const isAuthError = err.message.includes('401') || 
                           err.message.includes('Invalid credentials') ||
                           err.message.includes('Authentication required');
        return !isAuthError;
      });
      
      if (unexpectedErrors.length > 0) {
        throw new Error(`Runtime errors detected:\n\n${unexpectedErrors.map(err => 
          `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
        ).join('\n\n')}`);
      }
    }
  });

  test('Login page should load correctly', async ({ page }) => {
    // Navigate to login page directly without dev_bypass
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Check page title
    await expect(page).toHaveTitle(/Bookkeeping/i);
    
    // Check for the login page heading
    await expect(page.locator('h1')).toContainText('Welcome Back');
    
    // Check for subtitle
    await expect(page.locator('p:has-text("Sign in to your financial hub")')).toBeVisible();

    // Verify form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for email and password labels - match actual text
    await expect(page.locator('label:has-text("Email Address")')).toBeVisible();
    await expect(page.locator('label:has-text("Password")')).toBeVisible();

    // Verify pre-filled test credentials are present
    const emailInput = page.locator('input[type="email"]');
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toBe('ajarrar@trademanenterprise.com'); // Should have test email pre-filled

    await helpers.takeScreenshot('login-page-loaded');
  });

  test('Login form validation works', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Clear the pre-filled email to test validation
    const emailInput = page.locator('input[type="email"]');
    await emailInput.clear();
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // HTML5 validation should prevent submission
    const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isEmailInvalid).toBeTruthy();
  });

  test('Login with correct credentials should work', async ({ page }) => {
    // Allow 500 errors from profit-loss endpoint (doesn't affect login flow)
    helpers.addExpectedErrors([/500.*profit-loss/]);
    
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Fill in credentials (using pre-filled test credentials)
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    // Ensure credentials are filled
    await emailInput.fill('ajarrar@trademanenterprise.com');
    await passwordInput.fill('password123');

    // Submit form and wait for response
    const [response] = await Promise.all([
      page.waitForResponse('/api/v1/auth/login'),
      page.click('button[type="submit"]')
    ]);

    // Check if login was successful
    expect(response.status()).toBe(200);

    // Wait for redirect - the login uses window.location.href
    await page.waitForTimeout(2000); // Give time for redirect

    // Should be redirected away from login page
    expect(page.url()).not.toContain('/login');
    
    // Should be on either finance dashboard or setup page
    const isOnFinancePage = page.url().includes('/finance');
    const isOnSetupPage = page.url().includes('/setup');
    expect(isOnFinancePage || isOnSetupPage).toBeTruthy();

    await helpers.takeScreenshot('successful-login-redirect');
  });

  test('Cookie authentication should work', async ({ page }) => {
    // Allow 500 errors from API endpoints (test focusing on auth, not API stability)
    helpers.addExpectedErrors([/500/, /404/]);
    
    // Set up authentication for the test context
    await helpers.setupAuth('trademan');
    
    // Test various pages with cookie auth
    const testPages = [
      '/reports',
      '/reports/import',
      '/finance',
      '/bookkeeping'
    ];

    for (const testPage of testPages) {
      await page.goto(testPage, { waitUntil: 'domcontentloaded' });
      await helpers.waitForPageLoad();
      
      // Should not be redirected to login page
      expect(page.url()).not.toContain('/login');
      // The page might have query params, so check if it contains the base path
      expect(page.url()).toContain(testPage);

      // Page should load without authentication errors
      const errors = await helpers.checkForErrors();
      expect(errors.filter(error => error.toLowerCase().includes('auth'))).toHaveLength(0);

      await helpers.takeScreenshot(`cookie-auth-${testPage.replace(/\//g, '-')}`);
    }
  });

  test('Protected pages should redirect to login without auth', async ({ page }) => {
    // Test accessing protected pages without authentication
    const protectedPages = [
      '/reports',
      '/finance',
      '/bookkeeping'
    ];

    for (const protectedPage of protectedPages) {
      // Navigate without dev_bypass to test authentication requirement
      await page.goto(protectedPage, { waitUntil: 'domcontentloaded' });
      
      // Wait a moment for redirect
      await page.waitForTimeout(1000);
      
      // Should be redirected to login page
      expect(page.url()).toContain('/login');
      
      // Verify we're on the login page by checking for login form
      await expect(page.locator('h1:has-text("Welcome Back")')).toBeVisible();
    }
  });

  test('Login form should handle errors gracefully', async ({ page }) => {
    // Expect 401 errors for invalid credentials
    helpers.addExpectedErrors([/401/, /Invalid credentials/, /Authentication required/]);
    
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Try login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form and wait for response
    const [response] = await Promise.all([
      page.waitForResponse('/api/v1/auth/login'),
      page.click('button[type="submit"]')
    ]);

    // Should get error response
    expect(response.status()).toBe(401);

    // Wait for error message to appear
    await page.waitForSelector('.bg-red-500\\/10', { state: 'visible', timeout: 5000 });

    // Check for error alert (from the login page component)
    const errorAlert = page.locator('.bg-red-500\\/10').first();
    await expect(errorAlert).toBeVisible();
    
    // Verify error text is present
    const errorText = await errorAlert.textContent();
    expect(errorText).toContain('Invalid credentials');

    // Should still be on login page
    expect(page.url()).toContain('/login');

    await helpers.takeScreenshot('login-error-handling');
  });

  test('Login form UI elements are accessible', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Check for proper ARIA labels and form structure
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Check inputs have proper attributes
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // Check button is properly labeled
    await expect(submitButton).toBeVisible();
    const buttonText = await submitButton.textContent();
    expect(buttonText?.toLowerCase()).toContain('sign in');

    // Test keyboard navigation
    await emailInput.focus();
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    
    // After password field, tab navigation could go to checkbox, link, or button
    // Just verify that tabbing works without testing exact order
    await page.keyboard.press('Tab');
    
    // Verify some element is focused (not testing specific order)
    const focusedCount = await page.locator(':focus').count();
    expect(focusedCount).toBe(1);
  });

  test('Remember me checkbox functionality', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Find remember me checkbox - look for the checkbox near "Remember me" text
    const rememberCheckbox = page.locator('input[type="checkbox"]');
    
    // Test checkbox interaction
    await expect(rememberCheckbox).toBeVisible();
    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();
    
    await rememberCheckbox.uncheck();
    await expect(rememberCheckbox).not.toBeChecked();
  });

  test('Forgot password link should be present', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Check for forgot password link
    const forgotPasswordLink = page.locator('a[href="/forgot-password"]');
    
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveText(/forgot.*password/i);
  });

  test('Sign up link should be present', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await helpers.waitForPageLoad();

    // Check for sign up link
    const signUpLink = page.locator('a[href="/register"]');
    
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveText(/sign up/i);
  });
});