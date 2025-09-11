import { test, expect } from '@playwright/test';

test.describe('Analytics and Cashflow Runtime Errors', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console error monitoring
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });
    
    // Attach error monitoring to context
    (page as any).consoleErrors = consoleErrors;
  });

  test('Analytics page should load without runtime errors', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    // Navigate to analytics page
    await page.goto('/analytics');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check for main content
    const mainContent = await page.locator('main').isVisible();
    expect(mainContent).toBeTruthy();
    
    // Check for any runtime errors
    expect(consoleErrors).toHaveLength(0);
    
    // Log any errors found
    if (consoleErrors.length > 0) {
      console.log('Analytics page errors:', consoleErrors);
    }
  });

  test('Analytics page interactions should not cause runtime errors', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    // Test date range selector if present
    const dateRangeButton = page.locator('button:has-text("Date Range"), button:has-text("Last 30 days"), button:has-text("This month")').first();
    if (await dateRangeButton.isVisible()) {
      await dateRangeButton.click();
      await page.waitForTimeout(500);
      
      // Check for dropdown options
      const dropdownOption = page.locator('[role="option"], [role="menuitem"]').first();
      if (await dropdownOption.isVisible()) {
        await dropdownOption.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Test any chart interactions
    const charts = await page.locator('canvas, svg.recharts-surface, [class*="chart"]').all();
    for (const chart of charts) {
      if (await chart.isVisible()) {
        // Hover over chart to trigger any interactive elements
        await chart.hover();
        await page.waitForTimeout(300);
      }
    }
    
    // Test filter buttons if present
    const filterButtons = await page.locator('button:has-text("Filter"), button:has-text("Export"), button:has-text("Download")').all();
    for (const button of filterButtons) {
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(300);
        
        // Close any opened modals
        const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(300);
        }
      }
    }
    
    // Check for runtime errors after interactions
    expect(consoleErrors).toHaveLength(0);
    
    if (consoleErrors.length > 0) {
      console.log('Analytics interaction errors:', consoleErrors);
    }
  });

  test('Cashflow page should load without runtime errors', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    // Navigate to cashflow page
    await page.goto('/cashflow');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check for main content
    const mainContent = await page.locator('main').isVisible();
    expect(mainContent).toBeTruthy();
    
    // Check for any runtime errors
    expect(consoleErrors).toHaveLength(0);
    
    // Log any errors found
    if (consoleErrors.length > 0) {
      console.log('Cashflow page errors:', consoleErrors);
    }
  });

  test('Cashflow page interactions should not cause runtime errors', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    await page.goto('/cashflow');
    await page.waitForLoadState('networkidle');
    
    // Test period selector if present
    const periodSelector = page.locator('button:has-text("Period"), button:has-text("Monthly"), button:has-text("Weekly")').first();
    if (await periodSelector.isVisible()) {
      await periodSelector.click();
      await page.waitForTimeout(500);
      
      // Select different period
      const periodOption = page.locator('[role="option"], [role="menuitem"]').first();
      if (await periodOption.isVisible()) {
        await periodOption.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Test cashflow chart interactions
    const cashflowCharts = await page.locator('[class*="cashflow"], [class*="cash-flow"], canvas, svg.recharts-surface').all();
    for (const chart of cashflowCharts) {
      if (await chart.isVisible()) {
        await chart.hover();
        await page.waitForTimeout(300);
        
        // Try clicking on chart areas
        const boundingBox = await chart.boundingBox();
        if (boundingBox) {
          await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
          await page.waitForTimeout(300);
        }
      }
    }
    
    // Test any transaction or detail views
    const detailButtons = await page.locator('button:has-text("View Details"), button:has-text("Transactions"), button:has-text("More")').all();
    for (const button of detailButtons) {
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(500);
        
        // Close any opened views
        const backButton = page.locator('button:has-text("Back"), button:has-text("Close")').first();
        if (await backButton.isVisible()) {
          await backButton.click();
          await page.waitForTimeout(300);
        }
      }
    }
    
    // Test export functionality if available
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await page.waitForTimeout(500);
      
      // Handle export modal
      const exportOption = page.locator('button:has-text("CSV"), button:has-text("PDF")').first();
      if (await exportOption.isVisible()) {
        await exportOption.click();
        await page.waitForTimeout(500);
      }
      
      // Close modal if still open
      const closeModal = page.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
      if (await closeModal.isVisible()) {
        await closeModal.click();
        await page.waitForTimeout(300);
      }
    }
    
    // Check for runtime errors after all interactions
    expect(consoleErrors).toHaveLength(0);
    
    if (consoleErrors.length > 0) {
      console.log('Cashflow interaction errors:', consoleErrors);
    }
  });

  test('Analytics data loading should handle errors gracefully', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    // Intercept API calls to simulate errors
    await page.route('**/api/v1/analytics/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    // Should show error state, not crash
    const errorMessage = await page.locator('text=/error|failed|unable/i').isVisible();
    
    // Check that page handles error gracefully without runtime errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Failed to fetch') && 
      !error.includes('500') &&
      !error.includes('Internal server error')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    if (criticalErrors.length > 0) {
      console.log('Analytics error handling issues:', criticalErrors);
    }
  });

  test('Cashflow data loading should handle errors gracefully', async ({ page }) => {
    const consoleErrors = (page as any).consoleErrors;
    
    // Intercept API calls to simulate errors
    await page.route('**/api/v1/cashflow/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/cashflow');
    await page.waitForLoadState('networkidle');
    
    // Should show error state, not crash
    const errorMessage = await page.locator('text=/error|failed|unable/i').isVisible();
    
    // Check that page handles error gracefully without runtime errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Failed to fetch') && 
      !error.includes('500') &&
      !error.includes('Internal server error')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    if (criticalErrors.length > 0) {
      console.log('Cashflow error handling issues:', criticalErrors);
    }
  });
});