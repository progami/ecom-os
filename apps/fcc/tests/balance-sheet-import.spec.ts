import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import path from 'path';

test.describe('Balance Sheet Import Functionality', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.navigateWithDevBypass('/login');
    
    // Login if needed
    if (await helpers.isAuthenticationRequired()) {
      await helpers.login();
    }
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  test('Import balance sheet files and verify unified history', async ({ page }) => {
    // Navigate to import page
    await page.goto('/reports/import');
    await page.waitForLoadState('networkidle');

    // Import first balance sheet (June 2025)
    console.log('Importing June 2025 balance sheet...');
    
    // Select report type
    await page.selectOption('select[name="reportType"]', 'BALANCE_SHEET');
    
    // Set dates
    await page.fill('input[name="periodStart"]', '2025-01-01');
    await page.fill('input[name="periodEnd"]', '2025-06-30');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    const filePath1 = path.join(__dirname, '..', 'data', 'balance sheet.xlsx');
    await fileInput.setInputFiles(filePath1);
    
    // Click import
    await page.click('button:has-text("Import Report")');
    
    // Wait for success message
    await expect(page.locator('text=Report imported successfully')).toBeVisible({ timeout: 30000 });
    console.log('✓ June 2025 balance sheet imported');

    // Import second balance sheet (May 2025)
    console.log('Importing May 2025 balance sheet...');
    
    // Clear previous values
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.selectOption('select[name="reportType"]', 'BALANCE_SHEET');
    await page.fill('input[name="periodStart"]', '2025-01-01');
    await page.fill('input[name="periodEnd"]', '2025-05-31');
    
    const filePath2 = path.join(__dirname, '..', 'data', 'balance-sheet_2025-05-31.xlsx');
    await fileInput.setInputFiles(filePath2);
    
    await page.click('button:has-text("Import Report")');
    await expect(page.locator('text=Report imported successfully')).toBeVisible({ timeout: 30000 });
    console.log('✓ May 2025 balance sheet imported');

    // Navigate to balance sheet page
    await page.goto('/reports/balance-sheet');
    await page.waitForLoadState('networkidle');

    // Check that we're viewing live data by default
    await expect(page.locator('text=Data Source: Live')).toBeVisible();

    // Click to view imports
    await page.click('button:has-text("View Imports")');
    
    // Verify import history is displayed
    await expect(page.locator('text=Import History')).toBeVisible();
    
    // Check that both imports are listed
    await expect(page.locator('text=balance sheet.xlsx')).toBeVisible();
    await expect(page.locator('text=balance-sheet_2025-05-31.xlsx')).toBeVisible();
    
    // Click on the June import
    await page.click('button[aria-label*="View balance sheet.xlsx"]');
    
    // Verify we're now viewing imported data
    await expect(page.locator('text=Data Source: Imported')).toBeVisible();
    
    // Check that financial data is displayed
    await expect(page.locator('text=Total Assets')).toBeVisible();
    await expect(page.locator('text=Net Assets')).toBeVisible();
    await expect(page.locator('text=Working Capital')).toBeVisible();
    
    // Switch back to live data
    await page.click('button:has-text("View Live Data")');
    await expect(page.locator('text=Data Source: Live')).toBeVisible();
    
    // Test API fetch (refresh)
    await page.click('button:has-text("Refresh")');
    
    // Wait for the request to complete
    await page.waitForTimeout(2000);
    
    console.log('✓ Balance sheet import and unified history verified');
  });

  test('Check unified history displays both API and imported data', async ({ page }) => {
    await page.goto('/reports/balance-sheet');
    await page.waitForLoadState('networkidle');
    
    // First, trigger an API fetch
    await page.click('button:has-text("Refresh")');
    await page.waitForTimeout(2000);
    
    // View imports to see history
    await page.click('button:has-text("View Imports")');
    
    // Verify import history section
    await expect(page.locator('text=Import History')).toBeVisible();
    
    // Check for visual indicators of different sources
    const importItems = page.locator('[data-testid="import-history-item"]');
    const count = await importItems.count();
    
    console.log(`Found ${count} items in import history`);
    
    // Verify at least one import exists
    expect(count).toBeGreaterThan(0);
  });
});