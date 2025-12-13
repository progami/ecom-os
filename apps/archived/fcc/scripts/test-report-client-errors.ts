#!/usr/bin/env tsx

import { chromium } from 'playwright';
import { structuredLogger } from '../lib/logger';

const BASE_URL = 'https://localhost:3003';

interface ConsoleError {
  page: string;
  type: string;
  message: string;
  stack?: string;
}

const reportPages = [
  { name: 'Main Reports Page', url: '/reports' },
  { name: 'Aged Payables Page', url: '/reports/aged-payables' },
  { name: 'Aged Receivables Page', url: '/reports/aged-receivables' },
  { name: 'Cash Flow Page', url: '/reports/cash-flow' },
  { name: 'Bank Summary Page', url: '/reports/bank-summary' },
  { name: 'P&L Detailed Page', url: '/reports/detailed-reports/profit-loss' },
  { name: 'Balance Sheet Page', url: '/reports/detailed-reports/balance-sheet' }
];

async function testReportPages() {
  console.log('Starting browser-based report page tests...');
  console.log('=========================================\n');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });

  const allErrors: ConsoleError[] = [];

  for (const reportPage of reportPages) {
    console.log(`\nTesting ${reportPage.name}...`);
    
    const page = await context.newPage();
    const pageErrors: ConsoleError[] = [];

    // Listen for console errors
    page.on('console', async msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        console.error(`  ❌ Console Error: ${errorText}`);
        
        // Try to get the stack trace
        let stack = '';
        try {
          const args = msg.args();
          if (args.length > 0) {
            const errorObj = await args[0].jsonValue();
            if (errorObj && typeof errorObj === 'object' && 'stack' in errorObj) {
              stack = errorObj.stack;
            }
          }
        } catch (e) {
          // Ignore stack extraction errors
        }

        pageErrors.push({
          page: reportPage.name,
          type: 'console',
          message: errorText,
          stack
        });
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.error(`  ❌ Page Error: ${error.message}`);
      pageErrors.push({
        page: reportPage.name,
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      });
    });

    // Listen for request failures
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.error(`  ❌ API Request Failed: ${url} - ${request.failure()?.errorText}`);
        pageErrors.push({
          page: reportPage.name,
          type: 'requestfailed',
          message: `${url} - ${request.failure()?.errorText}`
        });
      }
    });

    try {
      // Navigate to the page
      const response = await page.goto(`${BASE_URL}${reportPage.url}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        console.error(`  ❌ Page load failed with status: ${response?.status()}`);
      }

      // Wait a bit for any async errors
      await page.waitForTimeout(2000);

      // Check for specific error patterns in the DOM
      const errorElements = await page.$$eval('[class*="error"], [class*="Error"]', elements => 
        elements.map(el => el.textContent || '').filter(text => text.length > 0)
      );

      if (errorElements.length > 0) {
        console.error(`  ❌ Found error elements in DOM:`, errorElements);
        errorElements.forEach(errorText => {
          pageErrors.push({
            page: reportPage.name,
            type: 'dom',
            message: errorText
          });
        });
      }

      // Check for "Cannot read properties of undefined" specifically
      const pageContent = await page.content();
      if (pageContent.includes('Cannot read properties of undefined')) {
        const match = pageContent.match(/Cannot read properties of undefined[^<]*/);
        if (match) {
          console.error(`  ❌ Found "Cannot read properties of undefined" error in page`);
          pageErrors.push({
            page: reportPage.name,
            type: 'runtime',
            message: match[0]
          });
        }
      }

      if (pageErrors.length === 0) {
        console.log(`  ✅ No errors detected`);
      }

    } catch (error: any) {
      console.error(`  ❌ Test failed: ${error.message}`);
      pageErrors.push({
        page: reportPage.name,
        type: 'test',
        message: error.message
      });
    }

    allErrors.push(...pageErrors);
    await page.close();
  }

  await browser.close();

  // Summary
  console.log('\n\nERROR SUMMARY');
  console.log('=============');
  
  if (allErrors.length === 0) {
    console.log('\n✅ No errors found on any report page!');
  } else {
    console.log(`\n❌ Found ${allErrors.length} errors across ${reportPages.length} pages:\n`);
    
    // Group errors by page
    const errorsByPage = allErrors.reduce((acc, error) => {
      if (!acc[error.page]) {
        acc[error.page] = [];
      }
      acc[error.page].push(error);
      return acc;
    }, {} as Record<string, ConsoleError[]>);

    Object.entries(errorsByPage).forEach(([page, errors]) => {
      console.log(`\n${page}:`);
      errors.forEach(error => {
        console.log(`  - [${error.type}] ${error.message}`);
        if (error.stack) {
          console.log(`    Stack: ${error.stack.split('\n')[0]}`);
        }
      });
    });
  }

  // Log to development.log
  structuredLogger.info('[Report Client Error Test] Test completed', {
    component: 'report-client-error-test',
    totalPages: reportPages.length,
    totalErrors: allErrors.length,
    errors: allErrors
  });
}

// Run the tests
testReportPages().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});