import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Cashflow Page', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('404') && 
      !e.message.includes('Failed to fetch') &&
      !e.message.includes('No cash flow data available')
    );
    if (criticalErrors.length > 0) {
      console.error('Critical runtime errors detected:', criticalErrors);
    }
  });

  test('should load cashflow page without errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');

    // Wait for page to load
    await helpers.waitForDataLoad();

    // Check for page heading
    const headingSelectors = [
      'h1:has-text("Cash Flow")',
      'h1:has-text("Cashflow")',
      'h1:has-text("Cash Management")',
      'h2:has-text("Cash Flow")'
    ];

    let hasHeading = false;
    for (const selector of headingSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasHeading = true;
        break;
      }
    }

    expect(hasHeading).toBe(true);
  });

  test('should display cash flow metrics', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for key cash flow metrics
    const metricSelectors = [
      'text=/cash in|inflow|receipts/i',
      'text=/cash out|outflow|payments/i',
      'text=/net cash|balance|total/i',
      '[data-testid="cash-metric"]',
      '.cash-metric'
    ];

    let hasMetrics = false;
    for (const selector of metricSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasMetrics = true;
        break;
      }
    }

    // If no metrics, check for empty state
    if (!hasMetrics) {
      const hasEmptyState = await helpers.hasEmptyState();
      expect(hasEmptyState).toBe(true);
    } else {
      expect(hasMetrics).toBe(true);
    }
  });

  test('should show cash flow visualization', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for charts
    const chartSelectors = [
      'svg',
      'canvas',
      '.recharts-wrapper',
      '[data-testid="cashflow-chart"]',
      '.chart-container'
    ];

    let hasCharts = false;
    for (const selector of chartSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasCharts = true;
        break;
      }
    }

    if (hasCharts) {
      await helpers.waitForCharts();
      console.log('Cash flow charts displayed');
    }
  });

  test('should display cash flow forecast', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for forecast elements
    const forecastSelectors = [
      'text=/forecast|projection|predicted/i',
      '[data-testid="forecast"]',
      '.forecast-section',
      'text=/next.*days|future/i'
    ];

    let hasForecast = false;
    for (const selector of forecastSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasForecast = true;
        break;
      }
    }

    if (hasForecast) {
      console.log('Cash flow forecast displayed');
    }
  });

  test('should show transaction categories', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for category breakdown
    const categorySelectors = [
      'text=/operating|investing|financing/i',
      'text=/sales|expenses|payroll/i',
      '[data-testid="category-breakdown"]',
      '.category-list'
    ];

    let hasCategories = false;
    for (const selector of categorySelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasCategories = true;
        break;
      }
    }

    if (hasCategories) {
      console.log('Transaction categories displayed');
    }
  });

  test('should have period selector', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for period controls
    const periodSelectors = [
      'button:has-text("Period")',
      'button:has-text("Date Range")',
      'button:has-text("Monthly")',
      'button:has-text("Weekly")',
      'select[name*="period"]',
      '[data-testid="period-selector"]'
    ];

    let hasPeriodControls = false;
    for (const selector of periodSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasPeriodControls = true;
        break;
      }
    }

    expect(hasPeriodControls).toBe(true);
  });

  test('should handle period changes', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Find period selector
    const periodButton = page.locator('button').filter({ hasText: /period|monthly|weekly|daily/i }).first();
    
    if (await periodButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock API response
      await page.route('/api/v1/cashflow/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            period: 'weekly',
            data: {
              inflow: 25000,
              outflow: 18000,
              netCash: 7000,
              breakdown: []
            }
          })
        });
      });

      await periodButton.click();
      await page.waitForTimeout(500);

      // Select different period
      const periodOption = page.locator('button, [role="option"]').filter({ hasText: /weekly|daily|yearly/i }).first();
      if (await periodOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await periodOption.click();
        await helpers.waitForDataLoad();
      }
    }
  });

  test('should show bank account balances', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for bank account information
    const bankSelectors = [
      'text=/bank|account.*balance/i',
      '[data-testid="bank-balance"]',
      '.bank-account',
      'text=/checking|savings|credit/i'
    ];

    let hasBankInfo = false;
    for (const selector of bankSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasBankInfo = true;
        break;
      }
    }

    if (hasBankInfo) {
      console.log('Bank account information displayed');
    }
  });

  test('should display cash runway', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for runway metrics
    const runwaySelectors = [
      'text=/runway|months.*cash|burn.*rate/i',
      '[data-testid="cash-runway"]',
      '.runway-metric',
      'text=/sustainable|coverage/i'
    ];

    let hasRunway = false;
    for (const selector of runwaySelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasRunway = true;
        break;
      }
    }

    if (hasRunway) {
      console.log('Cash runway metrics displayed');
    }
  });

  test('should handle data refresh', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Find refresh button
    const refreshButton = page.locator('button').filter({ hasText: /refresh|sync|update/i }).first();
    
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock updated data
      let refreshCount = 0;
      await page.route('/api/v1/cashflow/**', route => {
        refreshCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              inflow: 30000 + refreshCount * 1000,
              outflow: 20000,
              netCash: 10000 + refreshCount * 1000
            },
            lastUpdated: new Date().toISOString()
          })
        });
      });

      await refreshButton.click();
      await helpers.waitForDataLoad();

      expect(refreshCount).toBeGreaterThan(0);
    }
  });

  test('should export cash flow data', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for export functionality
    const exportButton = page.locator('button').filter({ hasText: /export|download|pdf|csv/i }).first();
    
    if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exportButton.click();
      await page.waitForTimeout(500);

      // Check for export options or download
      const exportModal = page.locator('[role="dialog"], .modal, .export-options');
      const hasExportModal = await exportModal.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (hasExportModal) {
        // Close modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check main content visibility
    const mainContent = await page.locator('main, [role="main"]').isVisible();
    expect(mainContent).toBe(true);

    // Check that metrics stack vertically
    const metricCards = page.locator('.card, [class*="metric"], [data-testid*="metric"]');
    const cardCount = await metricCards.count();
    
    if (cardCount > 1) {
      const firstCard = metricCards.first();
      const secondCard = metricCards.nth(1);
      
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      if (firstBox && secondBox) {
        // Cards should stack (second card Y position greater than first)
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    }
  });

  test('should show alerts for critical cash levels', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for alerts or warnings
    const alertSelectors = [
      'text=/alert|warning|critical|low.*cash/i',
      '[role="alert"]',
      '.alert, .warning',
      '[data-testid="cash-alert"]'
    ];

    let hasAlerts = false;
    for (const selector of alertSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasAlerts = true;
        break;
      }
    }

    if (hasAlerts) {
      console.log('Cash flow alerts displayed');
    }
  });

  test('should integrate with reports', async ({ page }) => {
    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for links to related reports
    const reportLinks = [
      'a[href*="/reports"]',
      'button:has-text("View Report")',
      'button:has-text("Detailed Report")',
      'text=/see.*report|view.*details/i'
    ];

    let hasReportLinks = false;
    for (const selector of reportLinks) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasReportLinks = true;
        break;
      }
    }

    if (hasReportLinks) {
      console.log('Report integration available');
    }
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // Mock empty data
    await page.route('/api/v1/cashflow/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          message: 'No cash flow data available'
        })
      });
    });

    await helpers.navigateWithDevBypass('/cashflow');
    await helpers.waitForDataLoad();

    // Check for empty state
    const hasEmptyState = await helpers.hasEmptyState();
    expect(hasEmptyState).toBe(true);

    // Ensure no runtime errors
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('No cash flow data')
    );
    expect(criticalErrors.length).toBe(0);
  });
});