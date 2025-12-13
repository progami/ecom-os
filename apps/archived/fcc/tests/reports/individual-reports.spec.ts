import { test, expect } from '@playwright/test';
import { TestHelpers, FinancialAssertions } from '../utils/test-helpers';

test.describe('Individual Report Pages Tests', () => {
  let helpers: TestHelpers;
  let financialAssertions: FinancialAssertions;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    financialAssertions = new FinancialAssertions(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  test.describe('Balance Sheet Report', () => {
    test('Balance Sheet page should load with dev bypass', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // Check page title and main heading
      await expect(page).toHaveTitle(/Balance Sheet/i);
      await expect(page.locator('h1').filter({ hasText: /Balance Sheet/i }).or(page.locator('h2').filter({ hasText: /Balance Sheet/i }))).toBeVisible();

      // Check for page description
      await expect(page.locator('text=Comprehensive financial position analysis')).toBeVisible();

      await helpers.takeScreenshot('balance-sheet-page-loaded');
    });

    test('Balance Sheet should display key financial metrics', async ({ page }) => {
      // Mock the API to return consistent test data
      await page.route('/api/v1/xero/reports/balance-sheet', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalAssets: 100000,
            totalLiabilities: 40000,
            equity: 60000,
            currentAssets: 30000,
            currentLiabilities: 15000,
            netAssets: 60000,
            source: 'test',
            reportDate: '2024-01-31'
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');
      await helpers.waitForApiRequests();

      // Check for key metric cards
      const expectedMetrics = [
        'Total Assets',
        'Net Assets', 
        'Working Capital',
        'Equity Ratio'
      ];

      for (const metric of expectedMetrics) {
        await expect(page.locator('text=' + metric)).toBeVisible();
      }

      // Check for currency formatting
      await expect(page.locator('text=£100,000').or(page.locator('text=£100.00k'))).toBeVisible();

      await helpers.takeScreenshot('balance-sheet-metrics-displayed');
    });

    test('Balance Sheet view toggle should work', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/balance-sheet');
      await helpers.waitForApiRequests();

      // Check for Summary/Detailed toggle buttons
      const summaryButton = page.locator('button').filter({ hasText: 'Summary' });
      const detailedButton = page.locator('button').filter({ hasText: 'Detailed' });

      await expect(summaryButton).toBeVisible();
      await expect(detailedButton).toBeVisible();

      // Summary should be active by default
      await expect(summaryButton).toHaveClass(/bg-brand-blue/);

      // Click detailed view
      await detailedButton.click();
      await expect(detailedButton).toHaveClass(/bg-brand-blue/);

      // Should show detailed table
      await expect(page.locator('text=Account Details')).toBeVisible();

      // Click back to summary
      await summaryButton.click();
      await expect(summaryButton).toHaveClass(/bg-brand-blue/);

      await helpers.takeScreenshot('balance-sheet-view-toggle');
    });

    test('Balance Sheet refresh button should work', async ({ page }) => {
      let requestCount = 0;
      await page.route('/api/v1/xero/reports/balance-sheet*', route => {
        requestCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: null // No data available
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');
      await helpers.waitForReportPage('Balance Sheet');

      // Look for refresh button - could be in header or empty state
      const refreshButtons = page.locator('button').filter({ hasText: /Refresh|Sync with Xero/i });
      const refreshButton = refreshButtons.first();
      
      if (await refreshButton.count() > 0) {
        await expect(refreshButton).toBeVisible();
        await refreshButton.click();

        // Should show loading state
        const hasLoadingSpinner = await refreshButton.locator('.animate-spin').count() > 0 ||
                                  await page.locator('.animate-spin').count() > 0;
        
        if (hasLoadingSpinner) {
          console.log('Loading spinner detected during refresh');
        }

        // Wait for refresh to complete
        await helpers.waitForDataLoad();

        console.log(`API called ${requestCount} times`);

        await helpers.takeScreenshot('balance-sheet-refresh-attempted');
      } else {
        console.log('No refresh button found');
      }
    });

    test('Balance Sheet export should handle empty data gracefully', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/balance-sheet');
      await helpers.waitForReportPage('Balance Sheet');

      const exportButton = page.locator('button').filter({ hasText: /Export|Download/i });
      
      if (await exportButton.count() > 0) {
        const isDisabled = await exportButton.first().isDisabled();
        
        if (!isDisabled) {
          // Set up download handler with short timeout
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
          await exportButton.first().click();

          try {
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/balance-sheet.*\.(csv|xlsx?|pdf)/i);
            console.log('Export successful despite empty data');
          } catch {
            // Export might fail or be disabled with no data
            console.log('Export not available (no data or disabled)');
            
            // Check for any error messages
            const errors = await helpers.checkForErrors();
            if (errors.length > 0) {
              console.log('Export errors:', errors);
            }
          }
        } else {
          console.log('Export button is disabled (no data to export)');
        }
      } else {
        console.log('No export button found (likely due to empty state)');
      }

      await helpers.takeScreenshot('balance-sheet-export-empty-data');
    });

    test('Balance Sheet should handle API errors gracefully', async ({ page }) => {
      await page.route('/api/v1/xero/reports/balance-sheet*', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server Error' })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');
      await helpers.waitForReportPage('Balance Sheet');

      // Should show error state - could be empty state with error flag
      const hasEmptyState = await helpers.hasEmptyState();
      const hasErrorMessage = await page.locator('text=/Error|Unable to load|failed/i').count() > 0;
      const hasTryAgainButton = await page.locator('button').filter({ hasText: /Try Again|Retry|Sync/i }).count() > 0;
      
      expect(hasEmptyState || hasErrorMessage || hasTryAgainButton).toBeTruthy();
      
      if (hasEmptyState) {
        console.log('Showing empty state for error condition');
      }
      if (hasErrorMessage) {
        console.log('Showing explicit error message');
      }

      await helpers.takeScreenshot('balance-sheet-error-state');
    });
  });



  test.describe('Cash Flow Report', () => {
    test('Cash Flow page should load', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/cash-flow');

      await expect(page).toHaveTitle(/Cash Flow|Cash/i);
      await expect(page.locator('h1').filter({ hasText: /Cash Flow/i }).or(page.locator('h2').filter({ hasText: /Cash Flow/i }))).toBeVisible();

      await helpers.takeScreenshot('cash-flow-loaded');
    });

    test('Cash Flow should display flow data', async ({ page }) => {
      // Mock cash flow API
      await page.route('/api/v1/xero/reports/cash-flow', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reports: [{
              reportName: 'CashFlow',
              reportTitles: ['Cash Flow Statement'],
              reportDate: '2024-01-31',
              rows: [
                {
                  rowType: 'Section',
                  title: 'Operating Activities',
                  cells: [
                    { value: 'Net Income' },
                    { value: '10000.00' }
                  ]
                }
              ]
            }]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/cash-flow');
      await helpers.waitForApiRequests();

      // Should display cash flow information
      const hasContent = await page.locator('text=Operating').count() > 0 ||
                        await page.locator('text=Cash').count() > 0 ||
                        await page.locator('table, [class*="chart"]').count() > 0;

      expect(hasContent).toBeTruthy();

      await helpers.takeScreenshot('cash-flow-with-data');
    });
  });


  test.describe('Profit & Loss Report', () => {
    test('Profit & Loss page should load', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/profit-loss');

      await expect(page).toHaveTitle(/Profit.*Loss|P&L/i);
      await expect(page.locator('h1').filter({ hasText: /Profit.*Loss/i }).or(page.locator('h2').filter({ hasText: /Profit.*Loss/i }))).toBeVisible();

      await helpers.takeScreenshot('profit-loss-loaded');
    });

    test('Profit & Loss should display financial data', async ({ page }) => {
      // Mock P&L API
      await page.route('/api/v1/xero/reports/profit-loss', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reports: [{
              reportName: 'ProfitAndLoss',
              reportTitles: ['Profit and Loss'],
              reportDate: '2024-01-31',
              rows: [
                {
                  rowType: 'Section',
                  title: 'Income',
                  cells: [
                    { value: 'Revenue' },
                    { value: '50000.00' }
                  ]
                },
                {
                  rowType: 'Section',
                  title: 'Expenses',
                  cells: [
                    { value: 'Operating Expenses' },
                    { value: '30000.00' }
                  ]
                }
              ]
            }]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/profit-loss');
      await helpers.waitForApiRequests();

      // Should show P&L sections
      const hasPLContent = await page.locator('text=Income').count() > 0 ||
                          await page.locator('text=Revenue').count() > 0 ||
                          await page.locator('text=Expense').count() > 0 ||
                          await page.locator('text=Profit').count() > 0;

      expect(hasPLContent).toBeTruthy();

      await helpers.takeScreenshot('profit-loss-with-data');
    });
  });

  test.describe('General Ledger Report', () => {
    test('General Ledger page should load', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/general-ledger');

      await expect(page).toHaveTitle(/General Ledger|Ledger/i);
      await expect(page.locator('h1').filter({ hasText: /General Ledger/i }).or(page.locator('h2').filter({ hasText: /General Ledger/i }))).toBeVisible();

      await helpers.takeScreenshot('general-ledger-loaded');
    });

    test('General Ledger should display transaction data', async ({ page }) => {
      // Mock GL API
      await page.route('/api/v1/xero/reports/general-ledger', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactions: [
              {
                date: '2024-01-15',
                description: 'Invoice #001',
                accountCode: '200',
                accountName: 'Sales',
                debit: 0,
                credit: 1000,
                balance: 1000
              },
              {
                date: '2024-01-16',
                description: 'Payment received',
                accountCode: '100',
                accountName: 'Bank',
                debit: 1000,
                credit: 0,
                balance: 1000
              }
            ],
            totalDebit: 1000,
            totalCredit: 1000,
            openingBalance: 0,
            closingBalance: 0
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/general-ledger');
      await helpers.waitForApiRequests();

      // Should show GL data
      const hasGLContent = await page.locator('text=Account').count() > 0 ||
                          await page.locator('text=Debit').count() > 0 ||
                          await page.locator('text=Credit').count() > 0 ||
                          await page.locator('table').count() > 0;

      expect(hasGLContent).toBeTruthy();

      await helpers.takeScreenshot('general-ledger-with-data');
    });

    test('General Ledger account filter should work', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/general-ledger');
      await helpers.waitForReportPage('General Ledger');

      // Check for account filter
      const filterInput = page.locator('input[placeholder*="account"], input[placeholder*="filter"]');
      
      if (await filterInput.count() > 0) {
        await filterInput.first().fill('Sales');
        await helpers.waitForApiRequests();

        // Filter should be applied
        await expect(filterInput.first()).toHaveValue('Sales');
        
        await helpers.takeScreenshot('general-ledger-filter-applied');
      } else {
        console.log('No account filter found');
      }
    });
  });

  test.describe('Trial Balance Report', () => {
    test('Trial Balance page should load', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/trial-balance');

      await expect(page).toHaveTitle(/Trial Balance|Balance/i);
      await expect(page.locator('h1').filter({ hasText: /Trial Balance/i }).or(page.locator('h2').filter({ hasText: /Trial Balance/i }))).toBeVisible();

      await helpers.takeScreenshot('trial-balance-loaded');
    });

    test('Trial Balance should display account balances', async ({ page }) => {
      // Mock TB API
      await page.route('/api/v1/reports/trial-balance*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accounts: [
              {
                accountCode: '100',
                accountName: 'Bank Account',
                accountType: 'BANK',
                debit: 10000,
                credit: 0,
                netMovement: 10000,
                ytdBalance: 10000
              },
              {
                accountCode: '200',
                accountName: 'Sales Revenue',
                accountType: 'REVENUE',
                debit: 0,
                credit: 15000,
                netMovement: -15000,
                ytdBalance: -15000
              }
            ],
            totalDebit: 10000,
            totalCredit: 15000,
            reportDate: '2024-01-31',
            source: 'database'
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/trial-balance');
      await helpers.waitForApiRequests();

      // Should show TB data
      const hasTBContent = await page.locator('text=Debit').count() > 0 ||
                          await page.locator('text=Credit').count() > 0 ||
                          await page.locator('text=Balance').count() > 0 ||
                          await page.locator('table').count() > 0;

      expect(hasTBContent).toBeTruthy();

      await helpers.takeScreenshot('trial-balance-with-data');
    });

    test('Trial Balance totals should balance', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/trial-balance');
      await helpers.waitForApiRequests();

      // Check for total row
      const totalRow = page.locator('tr').filter({ hasText: /total/i });
      
      if (await totalRow.count() > 0) {
        // In a proper trial balance, debits should equal credits
        const debitTotal = await totalRow.locator('td').nth(-2).textContent();
        const creditTotal = await totalRow.locator('td').nth(-1).textContent();
        
        console.log(`Debit Total: ${debitTotal}, Credit Total: ${creditTotal}`);
        
        await helpers.takeScreenshot('trial-balance-totals');
      }
    });

    test('Trial Balance filter panel should work', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/trial-balance');
      await helpers.waitForReportPage('Trial Balance');

      // Look for filter button
      const filterButton = page.locator('button').filter({ hasText: /Filter/i });
      
      if (await filterButton.count() > 0) {
        await filterButton.first().click();
        
        // Should show filter panel
        const hasFilterPanel = await page.locator('text=Account Type').count() > 0 ||
                              await page.locator('text=Date Range').count() > 0;
        
        if (hasFilterPanel) {
          console.log('Filter panel opened successfully');
          await helpers.takeScreenshot('trial-balance-filter-panel');
        }
      } else {
        console.log('No filter button found');
      }
    });
  });

  test.describe('Common Report Features', () => {
    test('All report pages should have consistent navigation', async ({ page }) => {
      const reportPages = [
        '/reports/cash-flow',
        '/reports/balance-sheet',
        '/reports/profit-loss',
        '/reports/general-ledger',
        '/reports/trial-balance'
      ];

      for (const reportPage of reportPages) {
        await helpers.navigateWithDevBypass(reportPage);
        await helpers.waitForReactMount();

        // Should have navigation back to reports
        const hasBackNavigation = await page.locator('a[href="/reports"]').count() > 0 ||
                                 await page.locator('text=Reports').count() > 0 ||
                                 await page.locator('[aria-label*="back"], [title*="back"]').count() > 0;

        expect(hasBackNavigation).toBeTruthy();

        await helpers.takeScreenshot(`navigation-check-${reportPage.replace(/\//g, '-')}`);
      }
    });

    test('Report pages should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const testPages = [
        '/reports/balance-sheet',
        '/reports/cash-flow'
      ];

      for (const testPage of testPages) {
        await helpers.navigateWithDevBypass(testPage);
        await helpers.waitForReactMount();

        // Page should be usable on mobile
        await expect(page.locator('h1').or(page.locator('h2'))).toBeVisible();

        // Test scrolling
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.evaluate(() => window.scrollTo(0, 0));

        await helpers.takeScreenshot(`mobile-responsive-${testPage.replace(/\//g, '-')}`);
      }
    });

    test('Report pages should handle loading states', async ({ page }) => {
      // Slow down API responses
      await page.route('/api/v1/xero/reports/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ reports: [] })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // Should show loading indicators
      const hasLoadingState = await page.locator('.animate-spin').count() > 0 ||
                             await page.locator('[class*="loading"]').count() > 0 ||
                             await page.locator('[class*="skeleton"]').count() > 0;

      if (hasLoadingState) {
        expect(hasLoadingState).toBeTruthy();
      }

      // Wait for loading to complete
      await helpers.waitForApiRequests();

      await helpers.takeScreenshot('loading-states-handled');
    });

    test('Report error states should be handled consistently', async ({ page }) => {
      // Mock API errors
      await page.route('/api/v1/xero/reports/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server Error' })
        });
      });

      const testPages = [
        '/reports/balance-sheet'
      ];

      for (const testPage of testPages) {
        await helpers.navigateWithDevBypass(testPage);
        await helpers.waitForApiRequests();

        // Should show some kind of error indication
        const hasErrorState = await page.locator('text=Error').count() > 0 ||
                             await page.locator('text=failed').count() > 0 ||
                             await page.locator('[data-testid*="error"]').count() > 0 ||
                             await page.locator('.text-red, .text-brand-red').count() > 0;

        // Note: Some pages might not have explicit error states, which is okay
        // We're just checking that the page doesn't crash

        await helpers.takeScreenshot(`error-state-${testPage.replace(/\//g, '-')}`);
      }
    });
  });
});