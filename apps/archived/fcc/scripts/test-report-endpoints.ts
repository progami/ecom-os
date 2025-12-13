#!/usr/bin/env tsx

import fetch from 'node-fetch';
import { structuredLogger } from '../lib/logger';

const BASE_URL = 'http://localhost:3003';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  error?: string;
  dataStructure?: any;
}

const reportEndpoints = [
  { name: 'Financial Overview', url: '/api/v1/xero/reports/financial-overview' },
  { name: 'Aged Payables', url: '/api/v1/xero/reports/aged-payables' },
  { name: 'Aged Receivables', url: '/api/v1/xero/reports/aged-receivables' },
  { name: 'Cash Flow', url: '/api/v1/xero/reports/cash-flow' },
  { name: 'Bank Summary', url: '/api/v1/xero/reports/bank-summary' },
  { name: 'Profit & Loss', url: '/api/v1/xero/reports/profit-loss' },
  { name: 'Balance Sheet', url: '/api/v1/xero/reports/balance-sheet' }
];

async function testEndpoint(name: string, url: string): Promise<TestResult> {
  try {
    console.log(`\nTesting ${name}...`);
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`Invalid JSON response from ${name}:`, text.substring(0, 200));
      return {
        endpoint: name,
        status: response.status,
        success: false,
        error: 'Invalid JSON response'
      };
    }

    if (!response.ok) {
      console.error(`${name} failed with status ${response.status}:`, data.error || data);
      return {
        endpoint: name,
        status: response.status,
        success: false,
        error: data.error || 'Request failed'
      };
    }

    // Check data structure
    console.log(`${name} SUCCESS - Data structure:`, JSON.stringify(Object.keys(data), null, 2));
    
    // For aged payables/receivables, check if contacts array exists
    if (name.includes('Aged')) {
      if (!data.contacts || !Array.isArray(data.contacts)) {
        console.warn(`${name}: Missing or invalid 'contacts' array`);
      } else {
        console.log(`${name}: Found ${data.contacts.length} contacts`);
      }
    }

    return {
      endpoint: name,
      status: response.status,
      success: true,
      dataStructure: Object.keys(data)
    };

  } catch (error: any) {
    console.error(`${name} ERROR:`, error.message);
    return {
      endpoint: name,
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function testAllEndpoints() {
  console.log('Starting report endpoint tests...');
  console.log('================================\n');

  const results: TestResult[] = [];

  for (const endpoint of reportEndpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.url);
    results.push(result);
  }

  // Summary
  console.log('\n\nTEST SUMMARY');
  console.log('============');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`✅ ${r.endpoint} - Status: ${r.status}`);
    if (r.dataStructure) {
      console.log(`   Data keys: ${r.dataStructure.join(', ')}`);
    }
  });

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`❌ ${r.endpoint} - Status: ${r.status} - Error: ${r.error}`);
    });
  }

  // Log to development.log
  structuredLogger.info('[Report Endpoint Test] Test completed', {
    component: 'report-endpoint-test',
    totalEndpoints: results.length,
    successful: successful.length,
    failed: failed.length,
    results: results
  });
}

// Run the tests
testAllEndpoints().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});