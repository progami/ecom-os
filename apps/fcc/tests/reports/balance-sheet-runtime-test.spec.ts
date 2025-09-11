import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Balance Sheet Runtime Error Tests', () => {
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
  test('balance sheet page should load without runtime errors', async ({ page }) => {
    // Set up console error listener before navigation
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('Console error detected:', msg.text());
      }
    });

    // Navigate to balance sheet page with dev bypass
    await page.goto('/reports/balance-sheet?dev_bypass=true');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that the page header is visible
    await expect(page.getByText('Balance Sheet')).toBeVisible();
    
    // Wait a bit more to ensure all async operations complete
    await page.waitForTimeout(2000);
    
    // Filter out expected console errors (if any)
    const unexpectedErrors = consoleErrors.filter(error => {
      // Filter out known non-critical errors
      return !error.includes('Failed to load resource') &&
             !error.includes('favicon.ico') &&
             !error.includes('ResizeObserver');
    });
    
    // Assert no unexpected console errors
    expect(unexpectedErrors).toHaveLength(0);
    
    // Check that key metrics are displayed
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('Net Assets')).toBeVisible();
    await expect(page.getByText('Working Capital')).toBeVisible();
    await expect(page.getByText('Equity Ratio')).toBeVisible();
  });

  test('pie chart should render without percentage errors', async ({ page }) => {
    await page.goto('/reports/balance-sheet?dev_bypass=true');
    await page.waitForLoadState('networkidle');
    
    // Wait for chart to render
    await page.waitForTimeout(1000);
    
    // Check if pie chart container exists
    const chartContainer = page.locator('.recharts-wrapper').first();
    
    // If chart exists, check for percentage labels
    const chartExists = await chartContainer.isVisible().catch(() => false);
    
    if (chartExists) {
      // Look for percentage labels in the chart
      const percentageLabels = await page.locator('.recharts-pie-label-text').all();
      
      for (const label of percentageLabels) {
        const text = await label.textContent();
        // Verify the percentage format is correct (e.g., "25.5%")
        expect(text).toMatch(/^\d+\.\d+%$/);
        // Verify it's not "undefined%" or "NaN%"
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('NaN');
      }
    }
  });

  test('should handle missing data gracefully', async ({ page }) => {
    // Set up console error listener
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to balance sheet page with dev bypass
    await page.goto('/reports/balance-sheet?dev_bypass=true');
    await page.waitForLoadState('networkidle');
    
    // If no data is available, should show empty state
    const emptyStateVisible = await page.getByText('No balance sheet data available').isVisible().catch(() => false);
    
    if (emptyStateVisible) {
      // Verify no runtime errors occurred even with no data
      const unexpectedErrors = consoleErrors.filter(error => {
        return !error.includes('Failed to load resource') &&
               !error.includes('favicon.ico') &&
               !error.includes('ResizeObserver');
      });
      
      expect(unexpectedErrors).toHaveLength(0);
    }
  });
});