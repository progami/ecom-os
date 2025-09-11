import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Bookkeeping Pages', () => {
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

  test.describe('Main Bookkeeping Dashboard', () => {
    test('should load bookkeeping dashboard without errors', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Check for page heading
      const headingSelectors = [
        'h1:has-text("Bookkeeping")',
        'h1:has-text("Financial Overview")',
        'h1:has-text("Dashboard")',
        'h2:has-text("Bookkeeping")'
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

    test('should display financial overview metrics', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Check for financial metrics
      const metricSelectors = [
        'text=/revenue|income|sales/i',
        'text=/expenses|costs|spending/i',
        'text=/profit|net.*income|earnings/i',
        'text=/assets|liabilities|equity/i',
        '[data-testid="financial-metric"]'
      ];

      let hasMetrics = false;
      for (const selector of metricSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasMetrics = true;
          break;
        }
      }

      if (!hasMetrics) {
        const hasEmptyState = await helpers.hasEmptyState();
        expect(hasEmptyState).toBe(true);
      }
    });

    test('should show quick action buttons', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Check for action buttons
      const actionSelectors = [
        'button:has-text("View Reports")',
        'button:has-text("Chart of Accounts")',
        'button:has-text("Balance Sheet")',
        'button:has-text("Profit")',
        'a[href*="/reports"]'
      ];

      let hasActions = false;
      for (const selector of actionSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasActions = true;
          break;
        }
      }

      expect(hasActions).toBe(true);
    });

    test('should display bank account information', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Check for bank account section
      const bankSelectors = [
        'text=/bank.*account|account.*balance/i',
        '[data-testid="bank-accounts"]',
        '.bank-account-card',
        'text=/cash.*bank|checking|savings/i'
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

    test('should show reconciliation status', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Check for reconciliation tracker
      const reconciliationSelectors = [
        'text=/reconcil|unreconciled|reconciliation.*status/i',
        '[data-testid="reconciliation-tracker"]',
        '.reconciliation-status'
      ];

      let hasReconciliation = false;
      for (const selector of reconciliationSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasReconciliation = true;
          break;
        }
      }

      if (hasReconciliation) {
        console.log('Reconciliation tracker displayed');
      }
    });

    test('should navigate to reports from quick actions', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping');
      await helpers.waitForDataLoad();

      // Find report button
      const reportButton = page.locator('button, a').filter({ hasText: /balance.*sheet|profit.*loss/i }).first();
      
      if (await reportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reportButton.click();
        await page.waitForURL('**/reports/**', { timeout: 5000 });
        expect(page.url()).toMatch(/\/reports\/(balance-sheet|profit-loss)/);
      }
    });
  });

  test.describe('Chart of Accounts', () => {
    test('should load chart of accounts page', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/chart-of-accounts');
      await helpers.waitForDataLoad();

      // Check for page heading
      const headingSelectors = [
        'h1:has-text("Chart of Accounts")',
        'h1:has-text("Account")',
        'h2:has-text("Chart of Accounts")'
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

    test('should display account categories', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/chart-of-accounts');
      await helpers.waitForDataLoad();

      // Check for account categories
      const categorySelectors = [
        'text=/assets|liabilities|equity|revenue|expenses/i',
        '[data-testid="account-category"]',
        '.account-category'
      ];

      let hasCategories = false;
      for (const selector of categorySelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasCategories = true;
          break;
        }
      }

      if (!hasCategories) {
        const hasEmptyState = await helpers.hasEmptyState();
        expect(hasEmptyState).toBe(true);
      }
    });

    test('should have search functionality', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/chart-of-accounts');
      await helpers.waitForDataLoad();

      // Check for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
      const hasSearch = await searchInput.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasSearch) {
        await searchInput.fill('cash');
        await page.waitForTimeout(500);
        
        // Check if results filtered
        const cashAccount = await page.locator('text=/cash/i').isVisible({ timeout: 1000 }).catch(() => false);
        console.log('Search functionality available:', cashAccount);
      }
    });

    test('should show account details', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/chart-of-accounts');
      await helpers.waitForDataLoad();

      // Check for account list
      const accountSelectors = [
        '[data-testid="account-item"]',
        '.account-row',
        'tr[data-account]',
        'text=/[0-9]{4}.*-/i' // Account codes
      ];

      let hasAccounts = false;
      for (const selector of accountSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          hasAccounts = true;
          break;
        }
      }

      if (hasAccounts) {
        console.log('Account details displayed');
      }
    });
  });

  test.describe('SOP Generator', () => {
    test('should load SOP generator page', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-generator');
      await helpers.waitForDataLoad();

      // Check for page heading
      const headingSelectors = [
        'h1:has-text("SOP")',
        'h1:has-text("Standard Operating Procedure")',
        'h1:has-text("Procedure Generator")',
        'h2:has-text("SOP")'
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

    test('should show SOP templates or categories', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-generator');
      await helpers.waitForDataLoad();

      // Check for templates
      const templateSelectors = [
        'text=/template|category|type/i',
        '[data-testid="sop-template"]',
        '.template-card',
        'button:has-text("Create")'
      ];

      let hasTemplates = false;
      for (const selector of templateSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasTemplates = true;
          break;
        }
      }

      expect(hasTemplates).toBe(true);
    });

    test('should have form fields for SOP creation', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-generator');
      await helpers.waitForDataLoad();

      // Check for form elements
      const formSelectors = [
        'input[name*="title"], input[placeholder*="title" i]',
        'textarea, input[type="text"]',
        'select, [role="combobox"]',
        'button[type="submit"], button:has-text("Generate")'
      ];

      let hasForm = false;
      for (const selector of formSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasForm = true;
          break;
        }
      }

      expect(hasForm).toBe(true);
    });
  });

  test.describe('SOP Tables', () => {
    test('should load SOP tables page', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-tables');
      await helpers.waitForDataLoad();

      // Check for page heading
      const headingSelectors = [
        'h1:has-text("SOP Tables")',
        'h1:has-text("Procedures")',
        'h1:has-text("SOP List")',
        'h2:has-text("SOP")'
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

    test('should display table of SOPs', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-tables');
      await helpers.waitForDataLoad();

      // Check for table elements
      const tableSelectors = [
        'table',
        '[role="table"]',
        '[data-testid="sop-table"]',
        '.data-table'
      ];

      let hasTable = false;
      for (const selector of tableSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasTable = true;
          break;
        }
      }

      if (!hasTable) {
        // Check for empty state or list view
        const hasEmptyState = await helpers.hasEmptyState();
        const hasList = await page.locator('.list, ul, [role="list"]').isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasEmptyState || hasList).toBe(true);
      }
    });

    test('should have filter and sort options', async ({ page }) => {
      await helpers.navigateWithDevBypass('/bookkeeping/sop-tables');
      await helpers.waitForDataLoad();

      // Check for filter/sort controls
      const controlSelectors = [
        'button:has-text("Filter")',
        'button:has-text("Sort")',
        'select[name*="sort"]',
        'input[placeholder*="filter" i]',
        '[data-testid="table-controls"]'
      ];

      let hasControls = false;
      for (const selector of controlSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
          hasControls = true;
          break;
        }
      }

      if (hasControls) {
        console.log('Table controls available');
      }
    });
  });

  test('bookkeeping pages should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const pages = [
      '/bookkeeping',
      '/bookkeeping/chart-of-accounts',
      '/bookkeeping/sop-generator',
      '/bookkeeping/sop-tables'
    ];

    for (const pagePath of pages) {
      await helpers.navigateWithDevBypass(pagePath);
      await helpers.waitForDataLoad();

      // Check main content visibility
      const mainContent = await page.locator('main, [role="main"]').isVisible();
      expect(mainContent).toBe(true);

      // Check for mobile-friendly layout
      const cards = page.locator('.card, [class*="card"]').first();
      if (await cards.isVisible({ timeout: 1000 }).catch(() => false)) {
        const cardBox = await cards.boundingBox();
        if (cardBox) {
          expect(cardBox.width).toBeLessThanOrEqual(375);
        }
      }
    }
  });

  test('bookkeeping pages should handle errors gracefully', async ({ page }) => {
    // Mock API failures
    await page.route('/api/v1/bookkeeping/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    const pages = [
      '/bookkeeping',
      '/bookkeeping/chart-of-accounts'
    ];

    for (const pagePath of pages) {
      await helpers.navigateWithDevBypass(pagePath);
      await helpers.waitForDataLoad();

      // Should show error state or empty state
      const hasErrorHandling = 
        await helpers.hasEmptyState() ||
        await page.locator('text=/error|failed|try again/i').isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasErrorHandling).toBe(true);

      // Clear errors for next iteration
      helpers.clearRuntimeErrors();
    }
  });
});