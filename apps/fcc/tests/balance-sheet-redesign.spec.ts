import { test, expect } from '@playwright/test';
import { login, TestHelpers } from './utils/test-helpers';

test.describe('Balance Sheet Redesign', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await login(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  test('should display new tabbed interface', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    
    // Check tabs are visible
    await expect(page.getByRole('button', { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analysis/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Details/i })).toBeVisible();
    
    // Check Overview tab is active by default
    const overviewTab = page.getByRole('button', { name: /Overview/i });
    await expect(overviewTab).toHaveClass(/bg-slate-700/);
  });

  test('should display executive summary cards', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    
    // Wait for data to load
    await page.waitForSelector('text=Total Assets', { timeout: 10000 });
    
    // Check key metric cards
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('Total Liabilities')).toBeVisible();
    await expect(page.getByText('Net Assets')).toBeVisible();
    await expect(page.getByText('Working Capital')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    
    // Wait for initial load
    await page.waitForSelector('text=Financial Health Indicators');
    
    // Click Analysis tab
    await page.getByRole('button', { name: /Analysis/i }).click();
    await expect(page.getByText('Balance Sheet Composition')).toBeVisible();
    
    // Click Details tab
    await page.getByRole('button', { name: /Details/i }).click();
    await expect(page.getByText('Current Assets')).toBeVisible();
  });

  test('should have clean professional design', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    
    // Check for dark mode styling
    const container = page.locator('.container').first();
    await expect(container).toBeVisible();
    
    // Check for proper spacing and card layouts
    const cards = page.locator('.bg-slate-800\\/50');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should show history instead of data source toggle', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    
    // Check History button exists
    await expect(page.getByRole('button', { name: /History/i })).toBeVisible();
    
    // Old data source toggle should not exist
    await expect(page.getByText('Data Source:')).not.toBeVisible();
  });
});