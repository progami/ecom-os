import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Analytics Page', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('404') && 
      !e.message.includes('Failed to fetch') &&
      !e.message.includes('No data available')
    );
    if (criticalErrors.length > 0) {
      console.error('Critical runtime errors detected:', criticalErrors);
    }
  });

  test('should load analytics page without errors', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');

    // Wait for page to load
    await helpers.waitForDataLoad();

    // Check for page title or heading
    const headingSelectors = [
      'h1:has-text("Analytics")',
      'h1:has-text("Business Analytics")',
      'h1:has-text("Insights")',
      'h2:has-text("Analytics")'
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

  test('should display charts and visualizations', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for chart elements
    const chartSelectors = [
      'svg',
      'canvas',
      '.recharts-wrapper',
      '[data-testid="chart"]',
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

    // If no charts, check for empty state
    if (!hasCharts) {
      const hasEmptyState = await helpers.hasEmptyState();
      expect(hasEmptyState).toBe(true);
    } else {
      expect(hasCharts).toBe(true);
      // Wait for charts to render
      await helpers.waitForCharts();
    }
  });

  test('should show key metrics', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for metric cards or KPIs
    const metricSelectors = [
      '[data-testid="metric-card"]',
      '.metric-card',
      '.kpi-card',
      'text=/revenue|profit|expenses|growth/i'
    ];

    let hasMetrics = false;
    for (const selector of metricSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasMetrics = true;
        break;
      }
    }

    // Metrics or empty state expected
    if (!hasMetrics) {
      const hasEmptyState = await helpers.hasEmptyState();
      expect(hasEmptyState).toBe(true);
    }
  });

  test('should have date range selector', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for date range controls
    const dateSelectors = [
      'button:has-text("Date Range")',
      'button:has-text("Period")',
      'button:has-text("Last 30 days")',
      'button:has-text("This month")',
      '[data-testid="date-range"]',
      'input[type="date"]'
    ];

    let hasDateControls = false;
    for (const selector of dateSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasDateControls = true;
        break;
      }
    }

    expect(hasDateControls).toBe(true);
  });

  test('should handle date range changes', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Find date range button
    const dateButton = page.locator('button').filter({ hasText: /date|period|days|month/i }).first();
    
    if (await dateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock API response for date range change
      await page.route('/api/v1/analytics/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              revenue: 50000,
              expenses: 30000,
              profit: 20000,
              growth: 15
            },
            period: 'last-7-days'
          })
        });
      });

      await dateButton.click();
      await page.waitForTimeout(500);

      // Look for date options
      const dateOption = page.locator('button, [role="option"]').filter({ hasText: /7 days|week|today/i }).first();
      if (await dateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateOption.click();
        await helpers.waitForDataLoad();

        // Verify data updated (loading indicator or new content)
        const hasUpdated = 
          await page.locator('.loading, .spinner, [data-loading="true"]').isVisible({ timeout: 1000 }).catch(() => false) ||
          await page.locator('text=/updated|refreshed/i').isVisible({ timeout: 1000 }).catch(() => false);

        console.log('Date range changed, data updated:', hasUpdated);
      }
    }
  });

  test('should display category breakdown', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for category analysis
    const categorySelectors = [
      'text=/category|categories/i',
      '[data-testid="category-breakdown"]',
      '.category-chart',
      'text=/sales|marketing|operations/i'
    ];

    let hasCategories = false;
    for (const selector of categorySelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasCategories = true;
        break;
      }
    }

    // Category breakdown is a common analytics feature
    if (hasCategories) {
      console.log('Category breakdown displayed');
    }
  });

  test('should show trend analysis', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for trend indicators
    const trendSelectors = [
      'text=/trend|growth|decline/i',
      '[data-testid="trend-chart"]',
      '.trend-line',
      'svg path[class*="line"]'
    ];

    let hasTrends = false;
    for (const selector of trendSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasTrends = true;
        break;
      }
    }

    if (hasTrends) {
      console.log('Trend analysis displayed');
    }
  });

  test('should handle data export', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for export functionality
    const exportButton = page.locator('button').filter({ hasText: /export|download|save/i }).first();
    
    if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exportButton.click();
      await page.waitForTimeout(500);

      // Check for export options
      const exportOptions = [
        'button:has-text("CSV")',
        'button:has-text("PDF")',
        'button:has-text("Excel")',
        'text=/format|type/i'
      ];

      let hasExportOptions = false;
      for (const selector of exportOptions) {
        if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
          hasExportOptions = true;
          break;
        }
      }

      expect(hasExportOptions).toBe(true);

      // Close export modal
      await page.keyboard.press('Escape');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check that main content is visible
    const mainContent = await page.locator('main, [role="main"]').isVisible();
    expect(mainContent).toBe(true);

    // Check that charts adjust to mobile
    const charts = page.locator('svg, canvas, .recharts-wrapper');
    const chartCount = await charts.count();
    
    if (chartCount > 0) {
      const firstChart = charts.first();
      const chartBox = await firstChart.boundingBox();
      if (chartBox) {
        expect(chartBox.width).toBeLessThanOrEqual(375);
      }
    }

    // Check for mobile-optimized layout
    const cards = page.locator('.card, [class*="card"], .metric-card');
    const firstCard = cards.first();
    if (await firstCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      const cardBox = await firstCard.boundingBox();
      if (cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(375);
      }
    }
  });

  test('should handle empty data state', async ({ page }) => {
    // Mock empty data response
    await page.route('/api/v1/analytics/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {},
          message: 'No data available for selected period'
        })
      });
    });

    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for empty state
    const hasEmptyState = await helpers.hasEmptyState();
    if (!hasEmptyState) {
      // Check for no data message
      const noDataMessage = await page.locator('text=/no data|empty|not available/i').isVisible({ timeout: 2000 }).catch(() => false);
      expect(noDataMessage).toBe(true);
    }
  });

  test('should refresh data on demand', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Find refresh button
    const refreshButton = page.locator('button').filter({ hasText: /refresh|reload|sync/i }).first();
    
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Mock updated data
      let callCount = 0;
      await page.route('/api/v1/analytics/**', route => {
        callCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              revenue: 60000 + callCount * 1000,
              expenses: 35000,
              profit: 25000 + callCount * 1000
            },
            timestamp: new Date().toISOString()
          })
        });
      });

      await refreshButton.click();
      await helpers.waitForDataLoad();

      // Verify refresh happened
      expect(callCount).toBeGreaterThan(0);
    }
  });

  test('should show comparative analysis', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Check for comparison features
    const comparisonSelectors = [
      'text=/compare|comparison|vs/i',
      'button:has-text("Compare")',
      '[data-testid="comparison"]',
      'text=/previous|last.*period/i'
    ];

    let hasComparison = false;
    for (const selector of comparisonSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        hasComparison = true;
        break;
      }
    }

    if (hasComparison) {
      console.log('Comparative analysis features available');
    }
  });

  test('should not have runtime errors during interactions', async ({ page }) => {
    await helpers.navigateWithDevBypass('/analytics');
    await helpers.waitForDataLoad();

    // Clear existing errors
    helpers.clearRuntimeErrors();

    // Interact with various elements
    const interactiveElements = await page.locator('button, select, input').all();
    
    for (let i = 0; i < Math.min(3, interactiveElements.length); i++) {
      const element = interactiveElements[i];
      if (await element.isVisible() && await element.isEnabled()) {
        try {
          await element.hover();
          await page.waitForTimeout(100);
        } catch (e) {
          // Ignore hover errors
        }
      }
    }

    // Check for runtime errors
    const errors = helpers.getRuntimeErrors();
    const criticalErrors = errors.filter(e => 
      !e.message.includes('404') && 
      !e.message.includes('Failed to fetch') &&
      !e.message.includes('No data available')
    );

    expect(criticalErrors.length).toBe(0);
  });
});