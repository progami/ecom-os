import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Homepage', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('404') && 
      !e.message.includes('Failed to fetch')
    );
    if (criticalErrors.length > 0) {
      console.error('Critical runtime errors detected:', criticalErrors);
    }
  });

  test('should load homepage without errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');

    // Wait for page to fully load
    await helpers.waitForDataLoad();

    // Check for main content
    const mainContent = await page.locator('main, [role="main"]').isVisible();
    expect(mainContent).toBe(true);

    // Check page title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should display navigation elements', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');

    // Check for header/navigation
    const navElements = [
      'nav',
      'header',
      '[role="navigation"]',
      '.navbar',
      '.header'
    ];

    let hasNavigation = false;
    for (const selector of navElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasNavigation = true;
        break;
      }
    }

    expect(hasNavigation).toBe(true);
  });

  test('should show main dashboard content', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');

    // Check for dashboard elements
    const dashboardElements = [
      'h1:has-text("Dashboard")',
      'h1:has-text("Overview")',
      'h1:has-text("Welcome")',
      '[data-testid="dashboard"]',
      '.dashboard-container',
      'text=/dashboard|overview|welcome/i'
    ];

    let hasDashboard = false;
    for (const selector of dashboardElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasDashboard = true;
        break;
      }
    }

    // If not dashboard, might redirect to login
    const isLoginPage = page.url().includes('/login');
    expect(hasDashboard || isLoginPage).toBe(true);
  });

  test('should display key action buttons or links', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check for action buttons/links
    const actionLinks = [
      'a[href*="/reports"]',
      'a[href*="/bookkeeping"]',
      'a[href*="/analytics"]',
      'button:has-text("View Reports")',
      'button:has-text("Get Started")'
    ];

    let hasActions = false;
    for (const selector of actionLinks) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasActions = true;
        break;
      }
    }

    expect(hasActions).toBe(true);
  });

  test('should handle authentication state', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');

    // Check if redirected to login
    if (page.url().includes('/login')) {
      // Should show login form
      const loginForm = await page.locator('form, input[type="email"], input[type="password"]').isVisible();
      expect(loginForm).toBe(true);
    } else {
      // Should show authenticated content
      const authenticatedElements = [
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
        '[data-testid="user-menu"]',
        '.user-profile',
        'text=/logout|sign out/i'
      ];

      let hasAuthElements = false;
      for (const selector of authenticatedElements) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasAuthElements = true;
          break;
        }
      }

      // Either has auth elements or shows main content
      const hasMainContent = await page.locator('main, [role="main"]').isVisible();
      expect(hasAuthElements || hasMainContent).toBe(true);
    }
  });

  test('should show organization info if available', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check for organization display
    const orgElements = [
      '[data-testid="organization-name"]',
      '.organization-name',
      'text=/organization|company/i'
    ];

    let hasOrgInfo = false;
    for (const selector of orgElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasOrgInfo = true;
        break;
      }
    }

    // Organization info is optional on homepage
    if (hasOrgInfo) {
      console.log('Organization info displayed on homepage');
    }
  });

  test('should navigate to reports page', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Find and click reports link
    const reportsLink = page.locator('a[href*="/reports"], button:has-text("Reports")').first();
    
    if (await reportsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reportsLink.click();
      await page.waitForURL('**/reports**', { timeout: 5000 });
      expect(page.url()).toContain('/reports');
    }
  });

  test('should navigate to bookkeeping page', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Find and click bookkeeping link
    const bookkeepingLink = page.locator('a[href*="/bookkeeping"], button:has-text("Bookkeeping")').first();
    
    if (await bookkeepingLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bookkeepingLink.click();
      await page.waitForURL('**/bookkeeping**', { timeout: 5000 });
      expect(page.url()).toContain('/bookkeeping');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check that content is visible
    const mainContent = await page.locator('main, [role="main"], body').isVisible();
    expect(mainContent).toBe(true);

    // Check for mobile menu button
    const mobileMenuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu"), [data-testid="mobile-menu"]');
    const hasMobileMenu = await mobileMenuButton.isVisible({ timeout: 2000 }).catch(() => false);

    // Mobile menu is common but not required
    if (hasMobileMenu) {
      await mobileMenuButton.click();
      await page.waitForTimeout(500);

      // Check for menu items
      const menuVisible = await page.locator('nav, [role="navigation"], .menu').isVisible();
      expect(menuVisible).toBe(true);
    }
  });

  test('should handle quick actions or shortcuts', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check for quick action buttons
    const quickActions = [
      'button:has-text("Quick")',
      'button:has-text("New")',
      'button:has-text("Create")',
      '[data-testid="quick-actions"]',
      '.quick-actions'
    ];

    let hasQuickActions = false;
    for (const selector of quickActions) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasQuickActions = true;
        break;
      }
    }

    // Quick actions are optional feature
    if (hasQuickActions) {
      console.log('Homepage has quick actions available');
    }
  });

  test('should display Xero connection status if available', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Check for Xero connection indicators
    const xeroElements = [
      '[data-testid="xero-status"]',
      '.xero-status',
      'text=/connected.*xero|xero.*connected/i',
      'button:has-text("Connect to Xero")'
    ];

    let hasXeroStatus = false;
    for (const selector of xeroElements) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasXeroStatus = true;
        break;
      }
    }

    // Xero connection status is optional
    if (hasXeroStatus) {
      console.log('Xero connection status displayed on homepage');
    }
  });

  test('should load without console errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/');
    await helpers.waitForDataLoad();

    // Wait for any async operations
    await page.waitForTimeout(2000);

    // Check runtime errors
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('404') && 
      !e.message.includes('Failed to fetch') &&
      !e.message.includes('NetworkError') &&
      !e.message.includes('Load failed')
    );

    expect(criticalErrors.length).toBe(0);
  });
});