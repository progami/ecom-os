#!/usr/bin/env node

/**
 * Test script to debug Balance Sheet parser
 * This will fetch the Balance Sheet from Xero and log all the parsing details
 */

import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { structuredLogger } from '../lib/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testBalanceSheetParser() {
  try {
    console.log('Starting Balance Sheet parser test...\n');
    
    // Get tenant ID
    const tenantId = process.env['XERO_TENANT_ID'];
    
    if (!tenantId) {
      throw new Error('XERO_TENANT_ID not found in environment variables');
    }
    
    console.log(`Using Tenant ID: ${tenantId}\n`);
    
    // Fetch Balance Sheet
    console.log('Fetching Balance Sheet from Xero...');
    const balanceSheet = await XeroReportFetcher.fetchBalanceSheetSummary(tenantId);
    
    console.log('\n=== Balance Sheet Summary ===');
    console.log(JSON.stringify(balanceSheet, null, 2));
    
    console.log('\n=== Expected vs Actual Values ===');
    console.log('Cash:');
    console.log(`  Expected: £155,545.12`);
    console.log(`  Actual:   £${balanceSheet.cash.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Diff:     £${(balanceSheet.cash - 155545.12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    console.log('\nInventory:');
    console.log(`  Expected: £82,023.47`);
    console.log(`  Actual:   £${balanceSheet.inventory.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Diff:     £${(balanceSheet.inventory - 82023.47).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    console.log('\nTotal Assets:');
    console.log(`  Expected: £241,145.98`);
    console.log(`  Actual:   £${balanceSheet.totalAssets.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Diff:     £${(balanceSheet.totalAssets - 241145.98).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    console.log('\nTotal Liabilities:');
    console.log(`  Expected: £50,439.71`);
    console.log(`  Actual:   £${balanceSheet.totalLiabilities.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  Diff:     £${(balanceSheet.totalLiabilities - 50439.71).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    console.log('\n\nCheck logs/development.log for detailed parsing information');
    
  } catch (error) {
    console.error('Error testing Balance Sheet parser:', error);
    structuredLogger.error('Balance Sheet parser test failed', error, {
      component: 'test-balance-sheet-parser'
    });
  }
}

// Run the test
testBalanceSheetParser().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});