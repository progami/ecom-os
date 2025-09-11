import { test, expect, ConsoleMessage, Request, Response } from '@playwright/test';

// Helper to track errors
interface ErrorTracker {
  consoleErrors: Array<{
    message: string;
    location?: string;
    stack?: string;
  }>;
  networkErrors: Array<{
    url: string;
    status: number;
    statusText: string;
  }>;
  pageErrors: Array<{
    message: string;
    stack?: string;
  }>;
}

// Initialize error tracker
function createErrorTracker(): ErrorTracker {
  return {
    consoleErrors: [],
    networkErrors: [],
    pageErrors: []
  };
}

// Setup error monitoring
async function setupErrorMonitoring(page: any, errorTracker: ErrorTracker) {
  // Monitor console errors
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const location = msg.location();
      errorTracker.consoleErrors.push({
        message: msg.text(),
        location: location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined,
        stack: msg.text()
      });
    }
  });

  // Monitor page errors (uncaught exceptions)
  page.on('pageerror', (error: Error) => {
    errorTracker.pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Monitor network errors - exclude expected failures
  page.on('response', (response: Response) => {
    const url = response.url();
    // Skip expected authentication/health check failures
    if (url.includes('/api/health') || 
        url.includes('/api/v1/auth/session') ||
        url.includes('/api/v1/xero/status') ||
        url.includes('/api/v1/database/status')) {
      return;
    }
    
    if (response.status() >= 400) {
      errorTracker.networkErrors.push({
        url: url,
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });

  // Monitor failed requests - exclude expected failures
  page.on('requestfailed', (request: Request) => {
    const url = request.url();
    // Skip expected failures
    if (url.includes('/api/health') || 
        url.includes('/api/v1/auth/session') ||
        url.includes('/api/v1/xero/status') ||
        url.includes('/api/v1/database/status') ||
        url.includes('_rsc=')) {
      return;
    }
    
    errorTracker.networkErrors.push({
      url: url,
      status: 0,
      statusText: request.failure()?.errorText || 'Request failed'
    });
  });
}

// Report errors for a specific page
function reportErrors(pageName: string, errorTracker: ErrorTracker) {
  const hasErrors = errorTracker.consoleErrors.length > 0 || 
                   errorTracker.networkErrors.length > 0 || 
                   errorTracker.pageErrors.length > 0;

  if (hasErrors) {
    console.log(`\n=== ERRORS FOUND ON ${pageName} ===`);
    
    if (errorTracker.consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      errorTracker.consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
        if (error.location) console.log(`     Location: ${error.location}`);
      });
    }

    if (errorTracker.networkErrors.length > 0) {
      console.log('\nNetwork Errors:');
      errorTracker.networkErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.status} ${error.statusText} - ${error.url}`);
      });
    }

    if (errorTracker.pageErrors.length > 0) {
      console.log('\nPage Errors (Uncaught Exceptions):');
      errorTracker.pageErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
        if (error.stack) console.log(`     Stack: ${error.stack.split('\n')[0]}`);
      });
    }
  } else {
    console.log(`\n✓ No runtime errors found on ${pageName}`);
  }

  return hasErrors;
}

test.describe('Runtime Error Detection - Report Pages', () => {
  test.setTimeout(30000); // Set timeout to 30 seconds per test
  
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Reports Hub - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to reports hub
    await page.goto('/reports?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    // Test interactive elements
    console.log('Testing Reports Hub interactive elements...');

    // Test quick action buttons if they exist
    const quickActions = await page.locator('button:visible').count();
    if (quickActions > 0) {
      console.log(`  Found ${quickActions} buttons`);
    }

    // Test report cards
    const reportCards = await page.locator('a[href*="/reports/"]').count();
    if (reportCards > 0) {
      console.log(`  Found ${reportCards} report links`);
    }

    // Report errors
    const hasErrors = reportErrors('Reports Hub', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Balance Sheet - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to balance sheet
    await page.goto('/reports/balance-sheet?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing Balance Sheet interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('Balance Sheet', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Profit & Loss - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to profit & loss
    await page.goto('/reports/profit-loss?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing Profit & Loss interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('Profit & Loss', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Cash Flow - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to cash flow
    await page.goto('/reports/cash-flow?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing Cash Flow interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('Cash Flow', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Trial Balance - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to trial balance
    await page.goto('/reports/trial-balance?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing Trial Balance interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('Trial Balance', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('General Ledger - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to general ledger
    await page.goto('/reports/general-ledger?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing General Ledger interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('General Ledger', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Import Reports - Check for runtime errors', async ({ page }) => {
    const errorTracker = createErrorTracker();
    await setupErrorMonitoring(page, errorTracker);

    // Navigate to import page
    await page.goto('/reports/import?dev_bypass=true', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('Testing Import Reports interactive elements...');

    // Check for basic elements
    const hasContent = await page.locator('body').textContent();
    console.log(`  Page has content: ${hasContent ? 'Yes' : 'No'}`);

    // Report errors
    const hasErrors = reportErrors('Import Reports', errorTracker);
    expect(hasErrors).toBe(false);
  });

  test('Summary - All Report Pages Runtime Errors', async () => {
    console.log('\n========================================');
    console.log('RUNTIME ERROR DETECTION SUMMARY');
    console.log('========================================');
    console.log('Tested Pages:');
    console.log('1. /reports - Reports Hub');
    console.log('2. /reports/balance-sheet - Balance Sheet Report');
    console.log('3. /reports/profit-loss - Profit & Loss Report');
    console.log('4. /reports/cash-flow - Cash Flow Report');
    console.log('5. /reports/trial-balance - Trial Balance Report');
    console.log('6. /reports/general-ledger - General Ledger Report');
    console.log('7. /reports/import - Import Reports');
    console.log('\nError Types Monitored:');
    console.log('- Console errors (JavaScript errors)');
    console.log('- Network errors (4xx, 5xx responses)');
    console.log('- Page errors (Uncaught exceptions)');
    console.log('- Failed network requests');
    console.log('\nNote: Expected authentication/health check failures are filtered out');
    console.log('========================================\n');
  });
});