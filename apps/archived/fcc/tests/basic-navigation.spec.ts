import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Basic Navigation Tests', () => {
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

  test('Reports page should be accessible', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Check page loaded
    await expect(page).toHaveTitle(/Bookkeeping/i);
    
    // Check for main content
    const hasMainContent = await page.locator('main').isVisible();
    expect(hasMainContent).toBeTruthy();

    // Check for navigation sidebar - it's an aside element
    const hasSidebar = await page.locator('aside').first().isVisible();
    expect(hasSidebar).toBeTruthy();

    await helpers.takeScreenshot('reports-page-loaded');
  });

  test('Navigation menu should contain key links', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Check for navigation links from the actual navigation structure
    const navLinks = [
      'Finance Overview',
      'Bookkeeping',
      'Reports',
      'Cash Flow',
      'Analytics'
    ];

    // Navigation items are buttons in the sidebar
    for (const linkText of navLinks) {
      const navButton = page.locator('aside button').filter({ hasText: linkText });
      await expect(navButton).toBeVisible();
    }

    await helpers.takeScreenshot('navigation-menu-visible');
  });

  test('Report cards should be clickable', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Wait for report cards to load
    await page.waitForSelector('.cursor-pointer', { timeout: 10000 });

    // Click on Balance Sheet report card - it's a div with cursor-pointer
    const reportCard = page.locator('div.cursor-pointer').filter({ hasText: 'Balance Sheet' });
    await expect(reportCard).toBeVisible();
    await reportCard.click();

    // Wait for navigation
    await page.waitForURL('**/reports/balance-sheet**', { timeout: 10000 });

    // Check we're on the right page
    expect(page.url()).toContain('/reports/balance-sheet');
  });

  test('Application should handle empty data gracefully', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports/balance-sheet');
    await helpers.waitForReportPage('Balance Sheet');

    // Should show either data or empty state
    const hasEmptyState = await helpers.hasEmptyState();
    const hasDataContent = await helpers.hasDataContent();
    
    expect(hasEmptyState || hasDataContent).toBeTruthy();

    await helpers.takeScreenshot('empty-state-or-data');
  });

  test('Page should be responsive', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Main content should still be visible
    const hasMainContent = await page.locator('main').isVisible();
    expect(hasMainContent).toBeTruthy();

    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(mobileMenuButton).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Content should still be visible
    expect(await page.locator('main').isVisible()).toBeTruthy();

    // Sidebar should be visible on desktop
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    await helpers.takeScreenshot('responsive-design');
  });

  test('Import functionality should be accessible', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Find Import Data button
    const importButton = page.locator('button').filter({ hasText: 'Import Data' });
    await expect(importButton).toBeVisible();
    await importButton.click();

    // Should navigate to import page
    await page.waitForURL('**/reports/import**', { timeout: 10000 });
    expect(page.url()).toContain('/reports/import');

    await helpers.takeScreenshot('import-page-loaded');
  });

  test('Application should not have runtime errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Navigate to a few pages to check for errors
    
    for (const path of paths) {
      await helpers.navigateWithDevBypass(path);
      await helpers.waitForDataLoad();
      
      // Check for runtime errors
      const errors = helpers.getRuntimeErrors();
      expect(errors.length).toBe(0);
    }

    await helpers.takeScreenshot('no-runtime-errors');
  });

  test('Quick actions should be functional', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Look for Quick Actions section
    const quickActionsHeading = page.locator('h3').filter({ hasText: 'Quick Actions' });
    
    await expect(quickActionsHeading).toBeVisible();
    
    // Check for action buttons
    const actionButtons = [
      'Export All Reports',
      'Schedule Reports', 
      'Custom Dashboard',
      'Set Alerts'
    ];
    
    for (const buttonText of actionButtons) {
      const button = page.locator('button').filter({ hasText: buttonText });
      await expect(button).toBeVisible();
    }

    await helpers.takeScreenshot('quick-actions-available');
  });

  test('Report hub should show all available reports', async ({ page }) => {
    await helpers.navigateWithDevBypass('/reports');
    await helpers.waitForReportPage('Reports');

    // Check for Available Reports heading
    await expect(page.locator('h2:has-text("Available Reports")')).toBeVisible();

    // Check for all report cards
    const expectedReports = [
      'Aged Payables',
      'Aged Receivables',
      'Cash Flow Statement',
      'Profit & Loss',
      'Balance Sheet',
      'Trial Balance',
      'General Ledger'
    ];

    for (const reportName of expectedReports) {
      const reportCard = page.locator('h3').filter({ hasText: reportName });
      await expect(reportCard).toBeVisible();
    }

    await helpers.takeScreenshot('all-reports-visible');
  });
});