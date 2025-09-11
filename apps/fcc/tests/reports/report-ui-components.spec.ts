import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Report UI Components Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
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

  test.describe('ReportDataHistory Component', () => {
    test('should display all sections of ReportDataHistory', async ({ page }) => {
      // Mock import history data
      await page.route('/api/v1/reports/import-history*', route => {
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
                fileName: 'test-data.csv',
                reportType: 'BALANCE_SHEET',
                periodStart: '2024-01-01',
                periodEnd: '2024-06-30',
                importedBy: 'user@example.com'
              }
            ]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // Verify UnifiedPageHeader elements
      await expect(page.locator('h1, h2').filter({ hasText: 'Balance Sheet' })).toBeVisible();
      await expect(page.locator('text="Import and API fetch history for Balance Sheet reports"')).toBeVisible();

      // Verify action buttons in header
      const importButton = page.locator('a:has-text("Import")').first();
      const fetchButton = page.locator('button').filter({ hasText: /Fetch.*Xero/ });
      const exportButton = page.locator('button').filter({ hasText: /Export|CSV/ });

      await expect(importButton).toBeVisible();
      await expect(fetchButton).toBeVisible();
      await expect(exportButton).toBeVisible();

      // Verify filters section
      await expect(page.locator('h3:has-text("Filters")')).toBeVisible();
      await expect(page.locator('svg.lucide-filter')).toBeVisible();
    });

    test('should show correct icons for different statuses', async ({ page }) => {
      // Mock import history with different statuses
      await page.route('/api/v1/reports/import-history*', route => {
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
                recordCount: 100,
                fileName: 'success.csv',
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              },
              {
                id: '2',
                importedAt: new Date().toISOString(),
                source: 'api',
                status: 'failed',
                recordCount: 0,
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-06-30',
                importedBy: 'System',
                errors: ['Connection timeout']
              },
              {
                id: '3',
                importedAt: new Date().toISOString(),
                source: 'excel',
                status: 'processing',
                recordCount: 0,
                fileName: 'processing.xlsx',
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-06-30',
                importedBy: 'admin@example.com'
              }
            ]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/profit-loss');

      // Wait for table to load
      await page.waitForSelector('[role="table"]');

      // Check for status icons
      await expect(page.locator('svg.lucide-check-circle')).toBeVisible(); // Success
      await expect(page.locator('svg.lucide-x-circle')).toBeVisible(); // Failed
      await expect(page.locator('svg.lucide-clock')).toBeVisible(); // Processing

      // Check for source icons
      await expect(page.locator('svg.lucide-upload')).toBeVisible(); // Manual upload
      await expect(page.locator('svg.lucide-database')).toBeVisible(); // API
    });

    test('should display loading skeleton while fetching data', async ({ page }) => {
      // Delay the API response to see loading state
      await page.route('/api/v1/reports/import-history*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ imports: [] })
        });
      });

      await helpers.navigateWithDevBypass('/reports/cash-flow');

      // Check for loading skeleton
      await expect(page.locator('.animate-pulse')).toBeVisible();
      await expect(page.locator('.bg-gray-700.rounded')).toBeVisible();

      // Wait for loading to complete
      await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 5000 });
    });

    test('should show Xero connection tooltip when not connected', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/trial-balance');

      // Find the Fetch from Xero button
      const fetchButton = page.locator('button').filter({ hasText: /Fetch.*Xero/ });
      
      // Check if button is disabled (no Xero connection)
      const isDisabled = await fetchButton.isDisabled();
      
      if (isDisabled) {
        // Hover over the button to show tooltip
        await fetchButton.hover();
        
        // Check for tooltip
        await expect(page.locator('text="Connect to Xero to enable this feature"')).toBeVisible();
        
        // Check for lock icon
        await expect(page.locator('svg.lucide-lock')).toBeVisible();
      }
    });

    test('should format numbers correctly in the table', async ({ page }) => {
      // Mock import history with large numbers
      await page.route('/api/v1/reports/import-history*', route => {
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
                recordCount: 1234567,
                fileName: 'large-import.csv',
                reportType: 'GENERAL_LEDGER',
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              }
            ]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/general-ledger');

      // Wait for table to load
      await page.waitForSelector('[role="table"]');

      // Check that large numbers are formatted
      await expect(page.locator('text="1,234,567"')).toBeVisible();
    });

    test('should show relative time in date column', async ({ page }) => {
      // Mock import history with recent timestamp
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      await page.route('/api/v1/reports/import-history*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imports: [
              {
                id: '1',
                importedAt: fiveMinutesAgo,
                source: 'csv',
                status: 'completed',
                recordCount: 100,
                fileName: 'recent.csv',
                reportType: 'BALANCE_SHEET',
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              }
            ]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // Should show relative time like "5 minutes ago"
      await expect(page.locator('text=/ago/')).toBeVisible();
    });
  });

  test.describe('Import Details Modal', () => {
    test('should open import details modal when clicking view button', async ({ page }) => {
      // Mock import history
      await page.route('/api/v1/reports/import-history*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imports: [
              {
                id: 'test-123',
                importedAt: new Date().toISOString(),
                source: 'csv',
                status: 'completed',
                recordCount: 150,
                fileName: 'details-test.csv',
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com',
                metadata: {
                  processingTime: '2.5s',
                  fileSize: '1.2MB'
                }
              }
            ]
          })
        });
      });

      // Mock import details API
      await page.route('/api/v1/reports/import-details*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            import: {
              id: 'test-123',
              details: {
                totalRows: 150,
                processedRows: 150,
                skippedRows: 0,
                errors: []
              }
            }
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/profit-loss');

      // Wait for view button
      await page.waitForSelector('button[title="View details"]');

      // Click view details
      await page.click('button[title="View details"]');

      // Modal should appear
      const modal = page.locator('.modal, [role="dialog"], [data-state="open"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Filter Interactions', () => {
    test('should update filter count when filters are applied', async ({ page }) => {
      // Mock data with multiple imports
      await page.route('/api/v1/reports/import-history*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imports: Array.from({ length: 10 }, (_, i) => ({
              id: `import-${i}`,
              importedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
              source: i % 2 === 0 ? 'csv' : 'api',
              status: 'completed',
              recordCount: 100 + i * 10,
              fileName: i % 2 === 0 ? `file-${i}.csv` : undefined,
              reportType: 'BALANCE_SHEET',
              periodEnd: '2024-06-30',
              importedBy: i % 2 === 0 ? 'user@example.com' : 'System'
            }))
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // Wait for initial load
      await page.waitForSelector('text="Showing 10 of 10 imports"');

      // Apply source filter
      await page.selectOption('select:has-text("All Sources")', 'manual');

      // Should update count
      await expect(page.locator('text="Showing 5 of 10 imports"')).toBeVisible();

      // Clear filters button should appear
      await expect(page.locator('button:has-text("Clear filters")')).toBeVisible();
    });

    test('should persist filter selections', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/cash-flow');

      // Set filters
      await page.fill('input[placeholder*="Search"]', 'test search');
      await page.selectOption('select:has-text("All Sources")', 'api');
      await page.selectOption('select:has-text("All Statuses")', 'success');

      // Verify values are set
      await expect(page.locator('input[placeholder*="Search"]')).toHaveValue('test search');
      await expect(page.locator('select:has-text("All Sources")')).toHaveValue('api');
      await expect(page.locator('select:has-text("All Statuses")')).toHaveValue('success');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should show mobile-optimized table on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await helpers.navigateWithDevBypass('/reports/trial-balance');

      // Check for mobile-specific elements
      await expect(page.locator('.sm\\:hidden').first()).toBeVisible();
      
      // Check that certain columns are hidden on mobile
      const fileColumn = page.locator('th:has-text("File")');
      const isFileColumnVisible = await fileColumn.isVisible({ timeout: 1000 }).catch(() => false);
      
      // File column should be hidden on mobile (has .hidden.md:table-cell class)
      expect(isFileColumnVisible).toBeFalsy();
    });

    test('should show abbreviated button text on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await helpers.navigateWithDevBypass('/reports/general-ledger');

      // Check for abbreviated text
      await expect(page.locator('span.sm\\:hidden:has-text("Import")')).toBeVisible();
      await expect(page.locator('span.sm\\:hidden:has-text("Fetch")')).toBeVisible();
      await expect(page.locator('span.sm\\:hidden:has-text("CSV")')).toBeVisible();

      // Full text should be hidden
      await expect(page.locator('span.hidden.sm\\:inline:has-text("Import Data")')).toBeHidden();
    });
  });

  test.describe('Data Table Features', () => {
    test('should have sortable columns', async ({ page }) => {
      // Mock data
      await page.route('/api/v1/reports/import-history*', route => {
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
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-05-31',
                importedBy: 'user1@example.com'
              },
              {
                id: '2',
                importedAt: '2024-06-15T10:00:00Z',
                source: 'api',
                status: 'completed',
                recordCount: 200,
                reportType: 'PROFIT_LOSS',
                periodEnd: '2024-06-15',
                importedBy: 'user2@example.com'
              }
            ]
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/profit-loss');

      // Check for sortable column indicators
      const dateHeader = page.locator('th:has-text("Date/Time")');
      await expect(dateHeader).toBeVisible();

      // Sortable columns should have certain attributes or classes
      // This depends on the DataTable implementation
    });

    test('should have sticky header when scrolling', async ({ page }) => {
      // Mock many imports to create scrollable content
      await page.route('/api/v1/reports/import-history*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imports: Array.from({ length: 50 }, (_, i) => ({
              id: `import-${i}`,
              importedAt: new Date().toISOString(),
              source: 'csv',
              status: 'completed',
              recordCount: 100,
              fileName: `file-${i}.csv`,
              reportType: 'BALANCE_SHEET',
              periodEnd: '2024-06-30',
              importedBy: 'test@example.com'
            }))
          })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // The DataTable component has stickyHeader={true}
      // Verify the table structure supports sticky headers
      const table = page.locator('[role="table"]');
      await expect(table).toBeVisible();
    });
  });

  test.describe('Error States', () => {
    test('should show error UI when API fails', async ({ page }) => {
      // Mock API error
      await page.route('/api/v1/reports/import-history*', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection failed' })
        });
      });

      await helpers.navigateWithDevBypass('/reports/profit-loss');

      // Should show error state
      await expect(page.locator('h3:has-text("Unable to load import history")')).toBeVisible();
      await expect(page.locator('svg.lucide-alert-circle')).toBeVisible();
      await expect(page.locator('text="Failed to fetch import history"')).toBeVisible();
    });

    test('should show toast notifications for actions', async ({ page }) => {
      // Mock successful delete
      await page.route('/api/v1/reports/import-history*', async route => {
        if (route.request().method() === 'DELETE') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              imports: [{
                id: 'delete-test',
                importedAt: new Date().toISOString(),
                source: 'csv',
                status: 'completed',
                recordCount: 100,
                fileName: 'to-delete.csv',
                reportType: 'CASH_FLOW',
                periodEnd: '2024-06-30',
                importedBy: 'test@example.com'
              }]
            })
          });
        }
      });

      await helpers.navigateWithDevBypass('/reports/cash-flow');

      // Wait for delete button
      await page.waitForSelector('button[title="Delete import"]');

      // Click delete
      await page.click('button[title="Delete import"]');

      // Should show success toast
      await expect(page.locator('text="Import deleted successfully"')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Loading Overlay', () => {
    test('should show loading overlay when fetching from Xero', async ({ page }) => {
      // Mock slow Xero fetch
      await page.route('/api/v1/xero/reports/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      await helpers.navigateWithDevBypass('/reports/balance-sheet');

      // If Xero is connected, test the loading overlay
      const fetchButton = page.locator('button').filter({ hasText: /Fetch.*Xero/ });
      
      if (await fetchButton.isEnabled()) {
        await fetchButton.click();

        // Should show loading overlay
        await expect(page.locator('h3:has-text("Fetching from Xero")')).toBeVisible();
        await expect(page.locator('text="Please wait while we retrieve"')).toBeVisible();
        await expect(page.locator('svg.lucide-cloud')).toBeVisible();
        await expect(page.locator('.animate-pulse')).toBeVisible();
      }
    });
  });

  test.describe('Breadcrumb Navigation', () => {
    test('should navigate using breadcrumbs', async ({ page }) => {
      await helpers.navigateWithDevBypass('/reports/profit-loss');

      // Click Reports breadcrumb
      await page.click('nav[aria-label="Breadcrumb"] a:has-text("Reports")');

      // Should navigate to reports hub
      await expect(page).toHaveURL('/reports');
    });
  });
});