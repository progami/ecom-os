#!/usr/bin/env tsx

import fetch from 'node-fetch';
import https from 'https';
import { structuredLogger } from '../lib/logger';

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const BASE_URL = 'https://localhost:3003';

interface PageTestResult {
  page: string;
  status: number;
  success: boolean;
  error?: string;
  contentSnippet?: string;
}

const reportPages = [
  { name: 'Main Reports Page', url: '/reports' },
  { name: 'Aged Payables Page', url: '/reports/aged-payables' },
  { name: 'Aged Receivables Page', url: '/reports/aged-receivables' },
  { name: 'Cash Flow Page', url: '/reports/cash-flow' },
  { name: 'Bank Summary Page', url: '/reports/bank-summary' },
  { name: 'P&L Detailed Page', url: '/reports/detailed-reports/profit-loss' },
  { name: 'Balance Sheet Detailed Page', url: '/reports/detailed-reports/balance-sheet' }
];

async function testPage(name: string, url: string): Promise<PageTestResult> {
  try {
    console.log(`\nTesting ${name}...`);
    const response = await fetch(`${BASE_URL}${url}`, {
      agent: httpsAgent,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const text = await response.text();
    
    if (!response.ok) {
      console.error(`${name} failed with status ${response.status}`);
      return {
        page: name,
        status: response.status,
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    // Check for common error indicators in the HTML
    const errorIndicators = [
      'Cannot read properties of undefined',
      'TypeError',
      'ReferenceError',
      'SyntaxError',
      'Error:',
      'error-boundary',
      'Something went wrong'
    ];

    let foundError = null;
    for (const indicator of errorIndicators) {
      if (text.includes(indicator)) {
        foundError = indicator;
        const errorContext = text.indexOf(indicator);
        const snippet = text.substring(Math.max(0, errorContext - 100), errorContext + 200);
        console.error(`Found error indicator "${indicator}" in ${name}:`, snippet);
        break;
      }
    }

    if (foundError) {
      return {
        page: name,
        status: response.status,
        success: false,
        error: `Contains error: ${foundError}`,
        contentSnippet: text.substring(0, 500)
      };
    }

    // Check if it's a Next.js error page
    if (text.includes('__next_error__') || text.includes('Application error: a client-side exception has occurred')) {
      console.error(`${name} contains Next.js error page`);
      return {
        page: name,
        status: response.status,
        success: false,
        error: 'Next.js error page',
        contentSnippet: text.substring(0, 500)
      };
    }

    console.log(`${name} SUCCESS - Page loaded without errors`);
    return {
      page: name,
      status: response.status,
      success: true
    };

  } catch (error: any) {
    console.error(`${name} ERROR:`, error.message);
    return {
      page: name,
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function testAllPages() {
  console.log('Starting report page tests...');
  console.log('=============================\n');

  const results: PageTestResult[] = [];

  for (const page of reportPages) {
    const result = await testPage(page.name, page.url);
    results.push(result);
  }

  // Summary
  console.log('\n\nPAGE TEST SUMMARY');
  console.log('=================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`✅ ${r.page} - Status: ${r.status}`);
  });

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`❌ ${r.page} - Status: ${r.status} - Error: ${r.error}`);
      if (r.contentSnippet) {
        console.log(`   Content snippet: ${r.contentSnippet.substring(0, 200)}...`);
      }
    });
  }

  // Log to development.log
  structuredLogger.info('[Report Page Test] Test completed', {
    component: 'report-page-test',
    totalPages: results.length,
    successful: successful.length,
    failed: failed.length,
    results: results
  });
}

// Run the tests
testAllPages().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});