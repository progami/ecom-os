import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Register Page', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      console.error('Runtime errors detected:', errors);
    }
  });

  test('should load register page without errors', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Check for page title
    await expect(page).toHaveTitle(/Register|Sign Up|Create Account/i);

    // Check for registration form elements
    const formElements = {
      nameInput: page.locator('input[name="name"], input[placeholder*="name" i]'),
      emailInput: page.locator('input[type="email"], input[name="email"]'),
      passwordInput: page.locator('input[type="password"]').first(),
      confirmPasswordInput: page.locator('input[type="password"]').nth(1),
      submitButton: page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")')
    };

    // Verify form elements are visible
    for (const [name, locator] of Object.entries(formElements)) {
      const isVisible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBe(true);
    }
  });

  test('should display validation errors for empty form submission', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Find and click submit button without filling form
    const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
    await submitButton.click();

    // Wait for validation errors
    await page.waitForTimeout(1000);

    // Check for error messages
    const errorMessages = page.locator('.error, .text-red-500, [role="alert"], .text-destructive');
    const errorCount = await errorMessages.count();
    expect(errorCount).toBeGreaterThan(0);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Enter invalid email
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await emailInput.fill('invalid-email');
    await emailInput.blur();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for email validation error
    const emailError = page.locator('text=/invalid.*email|email.*invalid|valid.*email/i');
    const hasEmailError = await emailError.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasEmailError).toBe(true);
  });

  test('should validate password confirmation', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Enter mismatched passwords
    const passwordInput = page.locator('input[type="password"]').first();
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    
    await passwordInput.fill('password123');
    await confirmPasswordInput.fill('password456');
    await confirmPasswordInput.blur();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for password mismatch error
    const passwordError = page.locator('text=/password.*match|match.*password|confirm.*password/i');
    const hasPasswordError = await passwordError.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasPasswordError).toBe(true);
  });

  test('should have link to login page', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Find login link
    const loginLink = page.locator('a[href*="/login"], a:has-text("Sign In"), a:has-text("Login")');
    const hasLoginLink = await loginLink.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasLoginLink).toBe(true);

    // Click login link and verify navigation
    if (hasLoginLink) {
      await loginLink.click();
      await page.waitForURL('**/login', { timeout: 5000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('should handle registration form submission', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Fill registration form
    const testUser = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!'
    };

    await page.locator('input[name="name"], input[placeholder*="name" i]').fill(testUser.name);
    await page.locator('input[type="email"], input[name="email"]').fill(testUser.email);
    await page.locator('input[type="password"]').first().fill(testUser.password);
    await page.locator('input[type="password"]').nth(1).fill(testUser.password);

    // Mock API response
    await page.route('/api/auth/register', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Registration successful' })
      });
    });

    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Check for success message or redirect
    const successMessage = page.locator('text=/success|registered|welcome/i');
    const hasSuccess = await successMessage.isVisible({ timeout: 2000 }).catch(() => false);
    const isRedirected = page.url().includes('/setup') || page.url().includes('/dashboard') || page.url().includes('/login');
    
    expect(hasSuccess || isRedirected).toBe(true);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Check that form is still accessible
    const formVisible = await page.locator('form').isVisible();
    expect(formVisible).toBe(true);

    // Check that all form fields are visible
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]').first();
    
    expect(await emailInput.isVisible()).toBe(true);
    expect(await passwordInput.isVisible()).toBe(true);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('https://localhost:3003/register', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Mock network failure
    await page.route('/api/auth/register', route => {
      route.abort('failed');
    });

    // Fill and submit form
    await page.locator('input[name="name"], input[placeholder*="name" i]').fill('Test User');
    await page.locator('input[type="email"], input[name="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.locator('input[type="password"]').nth(1).fill('password123');

    const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
    await submitButton.click();

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('text=/error|failed|try again/i');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(true);

    // Ensure no runtime errors
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => !e.message.includes('Failed to fetch'));
    expect(criticalErrors.length).toBe(0);
  });
});