import { test, expect } from '@playwright/test';
import { TestHelpers, FinancialAssertions } from '../utils/test-helpers';

test.describe('Comprehensive Report Pages E2E Tests', () => {
  let helpers: TestHelpers;
  let financialAssertions: FinancialAssertions;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    financialAssertions = new FinancialAssertions(page);
    
    // Set expected errors to ignore common warnings
    helpers.setExpectedErrors([
      /Failed to load resource.*favicon/,
      /404.*favicon/,
      /hydration/i,
    ]);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  // Define report types and their configurations
  const reportConfigs = [
    {
      name: 'Profit & Loss',
      path: '/reports/profit-loss',
      reportType: 'PROFIT_LOSS',
      description: 'Import and API fetch history for Profit & Loss reports',
      apiEndpoint: '/api/v1/xero/reports/profit-loss'
    },
    {
      name: 'Balance Sheet',
      path: '/reports/balance-sheet',
      reportType: 'BALANCE_SHEET',
      description: 'Import and API fetch history for Balance Sheet reports',
      apiEndpoint: '/api/v1/xero/reports/balance-sheet'
    },
    {
      name: 'Cash Flow',
      path: '/reports/cash-flow',
      reportType: 'CASH_FLOW',
      description: 'Import and API fetch history for Cash Flow reports',
      apiEndpoint: '/api/v1/xero/reports/cash-flow'
    },
    {
      name: 'Trial Balance',
      path: '/reports/trial-balance',
      reportType: 'TRIAL_BALANCE',
      description: 'Import and API fetch history for Trial Balance reports',
      apiEndpoint: '/api/v1/xero/reports/trial-balance'
    },
    {
      name: 'General Ledger',
      path: '/reports/general-ledger',
      reportType: 'GENERAL_LEDGER',
      description: 'Import and API fetch history for General Ledger reports',
      apiEndpoint: '/api/v1/xero/reports/general-ledger'
    }
  ];

  reportConfigs.forEach(({ name, path, reportType, description, apiEndpoint }) => {
    test.describe(`${name} Report Page`, () => {
      test(`should load ${name} page successfully`, async ({ page }) => {
        // Navigate with dev bypass
        await helpers.navigateWithDevBypass(path);

        // Verify page title
        await expect(page).toHaveTitle(new RegExp(name, 'i'));

        // Verify main heading
        const heading = page.locator('h1, h2').filter({ hasText: name });
        await expect(heading).toBeVisible();

        // Verify description is visible
        await expect(page.locator(`text="${description}"`)).toBeVisible();

        // Take screenshot for visual verification
        await helpers.takeScreenshot(`${reportType.toLowerCase()}-page-loaded`);
      });

      test(`should display all UI elements for ${name}`, async ({ page }) => {
        await helpers.navigateWithDevBypass(path);

        // Check for breadcrumbs
        await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
        await expect(page.locator('text="Reports"')).toBeVisible();
        await expect(page.locator(`text="${name}"`)).toBeVisible();

        // Check for action buttons
        const importButton = page.locator('a:has-text("Import"), a:has-text("Import Data")');
        await expect(importButton).toBeVisible();
        await expect(importButton).toHaveAttribute('href', `/reports/import?type=${reportType}`);

        const fetchButton = page.locator('button:has-text("Fetch"), button:has-text("Fetch from Xero")');
        await expect(fetchButton).toBeVisible();

        const exportButton = page.locator('button:has-text("Export"), button:has-text("CSV")');
        await expect(exportButton).toBeVisible();

        // Check for filters section
        await expect(page.locator('h3:has-text("Filters")')).toBeVisible();
        
        // Check for filter inputs
        await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
        await expect(page.locator('select').first()).toBeVisible(); // Source filter
        await expect(page.locator('select').nth(1)).toBeVisible(); // Status filter
        await expect(page.locator('input[type="date"]').first()).toBeVisible(); // Date range from
        await expect(page.locator('input[type="date"]').nth(1)).toBeVisible(); // Date range to
      });

      test(`should handle filters correctly for ${name}`, async ({ page }) => {
        // Mock import history data
        await page.route(`/api/v1/reports/import-history*`, route => {
          const url = new URL(route.request().url());
          const requestedReportType = url.searchParams.get('reportType');
          
          if (requestedReportType === reportType) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                imports: [
                  {
                    id: '1',
                    importedAt: '2024-06-20T10:00:00Z',
                    source: 'csv',
                    status: 'completed',
                    recordCount: 150,
                    fileName: 'test-import.csv',
                    reportType: reportType,
                    periodEnd: '2024-06-30',
                    importedBy: 'test@example.com'
                  },
                  {
                    id: '2',
                    importedAt: '2024-06-21T14:30:00Z',
                    source: 'api',
                    status: 'completed',
                    recordCount: 200,
                    reportType: reportType,
                    periodEnd: '2024-06-30',
                    importedBy: 'System'
                  },
                  {
                    id: '3',
                    importedAt: '2024-06-22T09:15:00Z',
                    source: 'excel',
                    status: 'failed',
                    recordCount: 0,
                    fileName: 'failed-import.xlsx',
                    reportType: reportType,
                    periodEnd: '2024-06-30',
                    importedBy: 'admin@example.com',
                    errors: ['Invalid data format']
                  }
                ]
              })
            });
          } else {
            route.fulfill({ status: 200, body: JSON.stringify({ imports: [] }) });
          }
        });

        await helpers.navigateWithDevBypass(path);

        // Wait for data to load
        await page.waitForSelector('text="Showing 3 of 3 imports"', { timeout: 10000 });

        // Test search filter
        await page.fill('input[placeholder*="Search"]', 'test-import.csv');
        await page.waitForSelector('text="Showing 1 of 3 imports"');
        await expect(page.locator('text="test-import.csv"')).toBeVisible();

        // Clear search
        await page.fill('input[placeholder*="Search"]', '');
        await page.waitForSelector('text="Showing 3 of 3 imports"');

        // Test source filter
        await page.selectOption('select:has-text("All Sources")', 'manual');
        await page.waitForSelector('text="Showing 2 of 3 imports"');

        // Test status filter
        await page.selectOption('select:has-text("All Statuses")', 'failed');
        await page.waitForSelector('text="Showing 1 of 3 imports"');
        await expect(page.locator('text="failed-import.xlsx"')).toBeVisible();

        // Test clear filters button
        await page.click('button:has-text("Clear filters")');
        await page.waitForSelector('text="Showing 3 of 3 imports"');
      });

      test(`should display import history table correctly for ${name}`, async ({ page }) => {
        // Mock import history data
        await page.route(`/api/v1/reports/import-history*`, route => {
          const url = new URL(route.request().url());
          if (url.searchParams.get('reportType') === reportType) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                imports: [
                  {
                    id: '1',
                    importedAt: new Date().toISOString(),
                    source: 'csv',
                    status: 'completed',
                    recordCount: 150,
                    fileName: 'financial-data.csv',
                    reportType: reportType,
                    periodStart: '2024-01-01',
                    periodEnd: '2024-06-30',
                    importedBy: 'john.doe@example.com'
                  }
                ]
              })
            });
          }
        });

        await helpers.navigateWithDevBypass(path);

        // Wait for table to load
        await page.waitForSelector('[role="table"]', { timeout: 10000 });

        // Verify table headers
        const headers = ['Date/Time', 'Source', 'Status', 'Records', 'Period', 'By'];
        for (const header of headers) {
          await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
        }

        // Verify data row
        await expect(page.locator('text="financial-data.csv"')).toBeVisible();
        await expect(page.locator('text="File Import"')).toBeVisible();
        await expect(page.locator('text="150"')).toBeVisible();
        await expect(page.locator('text="john.doe@example.com"')).toBeVisible();

        // Check action buttons
        const viewButton = page.locator('button[title="View details"]');
        await expect(viewButton).toBeVisible();
        
        const deleteButton = page.locator('button[title="Delete import"]');
        await expect(deleteButton).toBeVisible();
      });

      test(`should handle empty state correctly for ${name}`, async ({ page }) => {
        // Mock empty import history
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ imports: [] })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Verify empty state message
        await expect(page.locator('h3:has-text("No imports found")')).toBeVisible();
        await expect(page.locator('text="Import data from files or fetch from API to see history here"')).toBeVisible();
      });

      test(`should handle API errors gracefully for ${name}`, async ({ page }) => {
        // Mock API error
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Verify error state
        await expect(page.locator('h3:has-text("Unable to load import history")')).toBeVisible();
        await expect(page.locator('text="Failed to fetch import history"')).toBeVisible();
      });

      test(`should handle Fetch from Xero button correctly for ${name}`, async ({ page }) => {
        // Mock successful Xero fetch
        await page.route(apiEndpoint, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { message: 'Data fetched successfully' }
            })
          });
        });

        // Mock import history
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ imports: [] })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Check if Fetch from Xero button exists
        const fetchButton = page.locator('button:has-text("Fetch from Xero"), button:has-text("Fetch")');
        
        // Button should be disabled if no Xero connection (tooltip should show)
        const isDisabled = await fetchButton.isDisabled();
        
        if (!isDisabled) {
          // If enabled, test the fetch functionality
          await fetchButton.click();
          
          // Verify loading state
          await expect(page.locator('text="Fetching from Xero"')).toBeVisible();
          await expect(page.locator('text="Please wait while we retrieve"')).toBeVisible();
          
          // Wait for success toast
          await expect(page.locator('text="Successfully fetched latest data from Xero"')).toBeVisible({ timeout: 15000 });
        }
      });

      test(`should handle Export functionality for ${name}`, async ({ page }) => {
        // Mock import history data
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              imports: [{
                id: '1',
                importedAt: '2024-06-20T10:00:00Z',
                source: 'csv',
                status: 'completed',
                recordCount: 150,
                fileName: 'test.csv',
                reportType: reportType,
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              }]
            })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Set up download listener
        const downloadPromise = page.waitForEvent('download');
        
        // Click export button
        await page.click('button:has-text("Export"), button:has-text("CSV")');
        
        // Verify download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain(reportType);
        expect(download.suggestedFilename()).toContain('.csv');
      });

      test(`should handle View Details modal for ${name}`, async ({ page }) => {
        // Mock import history and details
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              imports: [{
                id: 'test-import-1',
                importedAt: '2024-06-20T10:00:00Z',
                source: 'csv',
                status: 'completed',
                recordCount: 150,
                fileName: 'detailed-import.csv',
                reportType: reportType,
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              }]
            })
          });
        });

        // Mock import details
        await page.route(`/api/v1/reports/import-details*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              import: {
                id: 'test-import-1',
                reportType: reportType,
                metadata: {
                  totalRows: 150,
                  processedRows: 150,
                  skippedRows: 0
                }
              }
            })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Wait for data to load
        await page.waitForSelector('button[title="View details"]');

        // Click view details button
        await page.click('button[title="View details"]');

        // Verify modal opens (implementation may vary)
        // The actual modal content depends on ImportDetailsModal component
        await expect(page.locator('.modal, [role="dialog"], [data-testid="import-details-modal"]')).toBeVisible({ timeout: 5000 });
      });

      test(`should navigate to import page with correct type for ${name}`, async ({ page }) => {
        await helpers.navigateWithDevBypass(path);

        // Click import button
        const importButton = page.locator('a:has-text("Import"), a:has-text("Import Data")');
        const href = await importButton.getAttribute('href');
        
        expect(href).toBe(`/reports/import?type=${reportType}`);

        // Click and verify navigation
        await importButton.click();
        await expect(page).toHaveURL(new RegExp(`/reports/import\\?type=${reportType}`));
      });

      test(`should handle date picker functionality for ${name}`, async ({ page }) => {
        // Mock import history with various dates
        await page.route(`/api/v1/reports/import-history*`, route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              imports: [
                {
                  id: '1',
                  importedAt: '2024-06-01T10:00:00Z',
                  source: 'csv',
                  status: 'completed',
                  recordCount: 100,
                  reportType: reportType,
                  periodEnd: '2024-05-31',
                  importedBy: 'test@example.com'
                },
                {
                  id: '2',
                  importedAt: '2024-06-15T10:00:00Z',
                  source: 'api',
                  status: 'completed',
                  recordCount: 200,
                  reportType: reportType,
                  periodEnd: '2024-06-15',
                  importedBy: 'System'
                },
                {
                  id: '3',
                  importedAt: '2024-06-30T10:00:00Z',
                  source: 'csv',
                  status: 'completed',
                  recordCount: 300,
                  reportType: reportType,
                  periodEnd: '2024-06-30',
                  importedBy: 'admin@example.com'
                }
              ]
            })
          });
        });

        await helpers.navigateWithDevBypass(path);

        // Wait for data to load
        await page.waitForSelector('text="Showing 3 of 3 imports"');

        // Set date range filter
        const fromDate = page.locator('input[type="date"]').first();
        const toDate = page.locator('input[type="date"]').nth(1);

        await fromDate.fill('2024-06-10');
        await toDate.fill('2024-06-20');

        // Verify filtered results
        await page.waitForSelector('text="Showing 1 of 3 imports"');
      });

      test(`should handle delete functionality for ${name}`, async ({ page }) => {
        // Mock import history
        await page.route(`/api/v1/reports/import-history*`, async route => {
          if (route.request().method() === 'GET') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                imports: [{
                  id: 'delete-test-1',
                  importedAt: '2024-06-20T10:00:00Z',
                  source: 'csv',
                  status: 'completed',
                  recordCount: 150,
                  fileName: 'to-delete.csv',
                  reportType: reportType,
                  periodEnd: '2024-06-30',
                  importedBy: 'test@example.com'
                }]
              })
            });
          } else if (route.request().method() === 'DELETE') {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true })
            });
          }
        });

        await helpers.navigateWithDevBypass(path);

        // Wait for delete button
        await page.waitForSelector('button[title="Delete import"]');

        // Click delete button
        await page.click('button[title="Delete import"]');

        // Verify success toast
        await expect(page.locator('text="Import deleted successfully"')).toBeVisible({ timeout: 5000 });
      });

      test(`should be responsive on mobile for ${name}`, async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await helpers.navigateWithDevBypass(path);

        // Verify mobile-specific UI adjustments
        // Check that abbreviated text is shown on mobile
        await expect(page.locator('text="Import"').or(page.locator('text="Import Data"'))).toBeVisible();
        await expect(page.locator('text="Fetch"').or(page.locator('text="Fetch from Xero"'))).toBeVisible();
        await expect(page.locator('text="CSV"').or(page.locator('text="Export"'))).toBeVisible();

        // Verify table is scrollable on mobile
        const table = page.locator('[role="table"]');
        await expect(table).toBeVisible();

        // Check mobile scroll indicator
        const scrollIndicator = page.locator('.sm\\:hidden svg.animate-pulse');
        // Scroll indicator might be visible if there's data
        
        // Take mobile screenshot
        await helpers.takeScreenshot(`${reportType.toLowerCase()}-mobile-view`);
      });
    });
  });

  test.describe('Cross-Report Navigation', () => {
    test('should navigate between different report pages', async ({ page }) => {
      // Start at reports hub
      await helpers.navigateWithDevBypass('/reports');

      // Navigate through each report
      for (const config of reportConfigs) {
        await page.click(`text="${config.name}"`);
        await expect(page).toHaveURL(config.path);
        await expect(page.locator(`h1:has-text("${config.name}"), h2:has-text("${config.name}")`)).toBeVisible();
        
        // Go back to reports hub
        await page.click('a:has-text("Reports")').first();
        await expect(page).toHaveURL('/reports');
      }
    });
  });

  test.describe('Performance Tests', () => {
    test('should load report pages within acceptable time', async ({ page }) => {
      for (const config of reportConfigs) {
        const startTime = Date.now();
        await helpers.navigateWithDevBypass(config.path);
        
        // Wait for main content to be visible
        await expect(page.locator(`h1:has-text("${config.name}"), h2:has-text("${config.name}")`)).toBeVisible();
        
        const loadTime = Date.now() - startTime;
        
        // Page should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);
        
        console.log(`${config.name} page loaded in ${loadTime}ms`);
      }
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      for (const config of reportConfigs) {
        await helpers.navigateWithDevBypass(config.path);

        // Check for proper heading hierarchy
        const h1Count = await page.locator('h1').count();
        const h2Count = await page.locator('h2').count();
        expect(h1Count + h2Count).toBeGreaterThan(0);

        // Check for breadcrumb navigation
        await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();

        // Check for proper table structure if data exists
        const table = page.locator('[role="table"]');
        if (await table.isVisible()) {
          await expect(table.locator('thead')).toBeVisible();
          await expect(table.locator('tbody')).toBeVisible();
        }

        // Check for proper button labels
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        for (let i = 0; i < buttonCount; i++) {
          const button = buttons.nth(i);
          const hasText = await button.textContent();
          const hasAriaLabel = await button.getAttribute('aria-label');
          const hasTitle = await button.getAttribute('title');
          
          // Button should have either visible text, aria-label, or title
          expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
        }
      }
    });
  });
});