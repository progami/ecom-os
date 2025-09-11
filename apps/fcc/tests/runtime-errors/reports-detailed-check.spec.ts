import { test, expect, Page } from '@playwright/test';

interface PageTestResult {
  url: string;
  title: string;
  hasErrors: boolean;
  consoleErrors: string[];
  networkErrors: string[];
  pageErrors: string[];
  elementsFound: {
    buttons: number;
    links: number;
    inputs: number;
    selects: number;
    tables: number;
  };
  pageContent: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasMainContent: boolean;
    loadTime: number;
  };
}

async function testReportPage(page: Page, pageName: string, url: string): Promise<PageTestResult> {
  const startTime = Date.now();
  const result: PageTestResult = {
    url,
    title: '',
    hasErrors: false,
    consoleErrors: [],
    networkErrors: [],
    pageErrors: [],
    elementsFound: {
      buttons: 0,
      links: 0,
      inputs: 0,
      selects: 0,
      tables: 0
    },
    pageContent: {
      hasHeader: false,
      hasFooter: false,
      hasMainContent: false,
      loadTime: 0
    }
  };

  // Set up error monitoring
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.consoleErrors.push(msg.text());
      result.hasErrors = true;
    }
  });

  page.on('pageerror', (error) => {
    result.pageErrors.push(error.message);
    result.hasErrors = true;
  });

  page.on('response', (response) => {
    const url = response.url();
    // Skip expected failures
    if (url.includes('/api/health') || 
        url.includes('/api/v1/auth/session') ||
        url.includes('/api/v1/xero/status') ||
        url.includes('/api/v1/database/status') ||
        url.includes('_rsc=')) {
      return;
    }
    
    if (response.status() >= 400) {
      result.networkErrors.push(`${response.status()} - ${url}`);
      result.hasErrors = true;
    }
  });

  // Navigate to the page
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Wait for JS to execute

  // Get page title
  result.title = await page.title();

  // Count interactive elements
  result.elementsFound.buttons = await page.locator('button:visible').count();
  result.elementsFound.links = await page.locator('a:visible').count();
  result.elementsFound.inputs = await page.locator('input:visible').count();
  result.elementsFound.selects = await page.locator('select:visible').count();
  result.elementsFound.tables = await page.locator('table:visible').count();

  // Check page structure
  result.pageContent.hasHeader = await page.locator('header, [role="banner"], nav').count() > 0;
  result.pageContent.hasFooter = await page.locator('footer, [role="contentinfo"]').count() > 0;
  result.pageContent.hasMainContent = await page.locator('main, [role="main"], .main-content').count() > 0;
  
  // Calculate load time
  result.pageContent.loadTime = Date.now() - startTime;

  // Print detailed report
  console.log(`\n=== ${pageName} ===`);
  console.log(`URL: ${url}`);
  console.log(`Title: ${result.title}`);
  console.log(`Load Time: ${result.pageContent.loadTime}ms`);
  console.log(`\nPage Structure:`);
  console.log(`  Header: ${result.pageContent.hasHeader ? '✓' : '✗'}`);
  console.log(`  Main Content: ${result.pageContent.hasMainContent ? '✓' : '✗'}`);
  console.log(`  Footer: ${result.pageContent.hasFooter ? '✓' : '✗'}`);
  console.log(`\nInteractive Elements:`);
  console.log(`  Buttons: ${result.elementsFound.buttons}`);
  console.log(`  Links: ${result.elementsFound.links}`);
  console.log(`  Inputs: ${result.elementsFound.inputs}`);
  console.log(`  Selects: ${result.elementsFound.selects}`);
  console.log(`  Tables: ${result.elementsFound.tables}`);
  
  if (result.hasErrors) {
    console.log(`\n❌ ERRORS DETECTED:`);
    if (result.consoleErrors.length > 0) {
      console.log(`  Console Errors: ${result.consoleErrors.length}`);
      result.consoleErrors.forEach(err => console.log(`    - ${err}`));
    }
    if (result.networkErrors.length > 0) {
      console.log(`  Network Errors: ${result.networkErrors.length}`);
      result.networkErrors.forEach(err => console.log(`    - ${err}`));
    }
    if (result.pageErrors.length > 0) {
      console.log(`  Page Errors: ${result.pageErrors.length}`);
      result.pageErrors.forEach(err => console.log(`    - ${err}`));
    }
  } else {
    console.log(`\n✓ No runtime errors detected`);
  }

  return result;
}

test.describe('Detailed Runtime Error Detection - Report Pages', () => {
  test.setTimeout(60000); // 60 seconds timeout
  
  const reportPages = [
    { name: 'Reports Hub', url: '/reports?dev_bypass=true' },
    { name: 'Balance Sheet', url: '/reports/balance-sheet?dev_bypass=true' },
    { name: 'Profit & Loss', url: '/reports/profit-loss?dev_bypass=true' },
    { name: 'Cash Flow', url: '/reports/cash-flow?dev_bypass=true' },
    { name: 'Trial Balance', url: '/reports/trial-balance?dev_bypass=true' },
    { name: 'General Ledger', url: '/reports/general-ledger?dev_bypass=true' },
    { name: 'Import Reports', url: '/reports/import?dev_bypass=true' }
  ];

  for (const reportPage of reportPages) {
    test(`${reportPage.name} - Detailed check`, async ({ page }) => {
      const result = await testReportPage(page, reportPage.name, reportPage.url);
      
      // Assert no errors
      expect(result.hasErrors).toBe(false);
      
      // Assert page has content
      expect(result.elementsFound.buttons + result.elementsFound.links).toBeGreaterThan(0);
    });
  }

  test('Summary Report', async () => {
    console.log('\n\n========================================');
    console.log('DETAILED RUNTIME ERROR DETECTION SUMMARY');
    console.log('========================================');
    console.log('\nTested Report Pages:');
    reportPages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.name} - ${page.url}`);
    });
    console.log('\nChecks Performed:');
    console.log('- Console errors (JavaScript runtime errors)');
    console.log('- Network errors (4xx, 5xx responses)');
    console.log('- Page errors (Uncaught exceptions)');
    console.log('- Page structure (header, main, footer)');
    console.log('- Interactive elements count');
    console.log('- Page load time');
    console.log('\nNote: Authentication and health check endpoints are excluded from error reporting');
    console.log('========================================\n');
  });
});