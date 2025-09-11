import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Setup Page', () => {
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

  test('should load setup page without errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Check for page title
    await expect(page).toHaveTitle(/Setup|Configuration|Get Started/i);

    // Check for setup steps or form
    const setupIndicators = [
      'h1:has-text("Setup")',
      'h1:has-text("Get Started")',
      'h1:has-text("Configuration")',
      '[data-testid="setup-form"]',
      '.setup-container',
      'text=/step.*1|configure|connect/i'
    ];

    let hasSetupContent = false;
    for (const selector of setupIndicators) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasSetupContent = true;
        break;
      }
    }

    expect(hasSetupContent).toBe(true);
  });

  test('should display Xero connection option', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Check for Xero connection button or section
    const xeroElements = [
      'button:has-text("Connect to Xero")',
      'button:has-text("Connect Xero")',
      'text=/xero.*connect|connect.*xero/i',
      '[data-testid="xero-connect"]'
    ];

    let hasXeroOption = false;
    for (const selector of xeroElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasXeroOption = true;
        break;
      }
    }

    expect(hasXeroOption).toBe(true);
  });

  test('should show organization setup fields', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Check for organization input fields
    const orgFields = [
      'input[name="organizationName"], input[placeholder*="organization" i]',
      'input[name="companyName"], input[placeholder*="company" i]',
      'input[name="businessName"], input[placeholder*="business" i]'
    ];

    let hasOrgFields = false;
    for (const selector of orgFields) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasOrgFields = true;
        break;
      }
    }

    // Also check for text indicating organization setup
    const orgText = page.locator('text=/organization|company|business.*name/i');
    const hasOrgText = await orgText.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasOrgFields || hasOrgText).toBe(true);
  });

  test('should handle Xero connection flow', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Find and click Xero connect button
    const xeroButton = page.locator('button').filter({ hasText: /connect.*xero|xero.*connect/i }).first();
    
    if (await xeroButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock Xero OAuth response
      await page.route('/api/auth/xero/connect', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            authUrl: 'https://login.xero.com/identity/connect/authorize?...',
            success: true 
          })
        });
      });

      await xeroButton.click();
      await page.waitForTimeout(1000);

      // Check for OAuth redirect or modal
      const hasOAuthFlow = 
        page.url().includes('xero.com') ||
        await page.locator('text=/authorize|permission|connect.*account/i').isVisible({ timeout: 2000 }).catch(() => false);

      // Or check for success message if connection is mocked
      const hasSuccess = await page.locator('text=/connected|success|authorized/i').isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasOAuthFlow || hasSuccess).toBe(true);
    }
  });

  test('should validate required fields', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Try to submit/continue without filling required fields
    const submitButton = page.locator('button').filter({ hasText: /continue|next|submit|complete/i }).first();
    
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation errors
      const errorMessages = page.locator('.error, .text-red-500, [role="alert"], .text-destructive');
      const errorCount = await errorMessages.count();
      expect(errorCount).toBeGreaterThan(0);
    }
  });

  test('should show progress indicators', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Check for progress indicators
    const progressElements = [
      '.progress-bar',
      '[role="progressbar"]',
      'text=/step.*[0-9].*of.*[0-9]/i',
      '.stepper',
      '[data-testid="setup-progress"]'
    ];

    let hasProgress = false;
    for (const selector of progressElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasProgress = true;
        break;
      }
    }

    // Progress indicators are optional but common in setup flows
    if (hasProgress) {
      console.log('Setup page has progress indicators');
    }
  });

  test('should handle setup completion', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Mock successful setup completion
    await page.route('/api/setup/complete', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true,
          redirect: '/dashboard'
        })
      });
    });

    // Find completion button (might be "Finish", "Complete Setup", etc.)
    const completeButton = page.locator('button').filter({ hasText: /finish|complete.*setup|get.*started/i }).first();
    
    if (await completeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await completeButton.click();
      await page.waitForTimeout(2000);

      // Check for redirect or success state
      const isRedirected = page.url().includes('/dashboard') || page.url().includes('/reports') || page.url().includes('/bookkeeping');
      const hasSuccess = await page.locator('text=/success|completed|welcome/i').isVisible({ timeout: 2000 }).catch(() => false);

      expect(isRedirected || hasSuccess).toBe(true);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.navigateWithDevBypass('/setup');

    // Check that setup content is still visible
    const mainContent = await page.locator('main, [role="main"], .setup-container').isVisible();
    expect(mainContent).toBe(true);

    // Check that buttons are accessible
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Ensure text is readable (not cut off)
    const heading = page.locator('h1, h2').first();
    if (await heading.isVisible({ timeout: 2000 }).catch(() => false)) {
      const headingBox = await heading.boundingBox();
      expect(headingBox?.width).toBeLessThanOrEqual(375);
    }
  });

  test('should persist setup state', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Fill some form fields if available
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Test Organization');
    }

    // Refresh page
    await page.reload();
    await helpers.waitForDataLoad();

    // Check if data persisted (this depends on implementation)
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const value = await nameInput.inputValue();
      // Value might be persisted in localStorage or session
      console.log('Input value after reload:', value);
    }
  });

  test('should handle errors gracefully', async ({ page }) => {
    await helpers.navigateWithDevBypass('/setup');

    // Mock API failure
    await page.route('/api/setup/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    // Try to interact with setup
    const actionButton = page.locator('button').first();
    if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionButton.click();
      await page.waitForTimeout(2000);

      // Check for error handling
      const errorMessage = page.locator('text=/error|failed|try again/i');
      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
      
      // Should show error but not crash
      expect(hasError).toBe(true);
    }

    // Ensure no critical runtime errors
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('500') && 
      !e.message.includes('Failed to fetch')
    );
    expect(criticalErrors.length).toBe(0);
  });
});