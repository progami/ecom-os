#!/usr/bin/env ts-node

import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { getTenantId } from '../lib/xero-helpers';
import { promises as fs } from 'fs';
import path from 'path';

async function testCashFlowFetcher() {
  try {
    console.log('=== Testing Cash Flow Statement Fetcher ===\n');

    // Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID found - please connect to Xero first');
    }

    console.log(`Tenant ID: ${tenantId}`);

    // Test for June 2025 (last complete month)
    const fromDate = new Date('2025-06-01');
    const toDate = new Date('2025-06-30');

    console.log(`\nFetching Cash Flow Statement for June 2025...`);
    console.log(`From: ${fromDate.toISOString().split('T')[0]}`);
    console.log(`To: ${toDate.toISOString().split('T')[0]}`);

    try {
      const cashFlowData = await XeroReportFetcher.fetchCashFlowStatement(
        tenantId,
        fromDate,
        toDate
      );

      console.log('\n✓ Successfully fetched Cash Flow Statement!');
      
      // Save the result for inspection
      const outputDir = path.join(process.cwd(), 'data', 'test-reports');
      await fs.mkdir(outputDir, { recursive: true });
      
      const fileName = `cash-flow-statement-${fromDate.toISOString().split('T')[0]}-to-${toDate.toISOString().split('T')[0]}.json`;
      const filePath = path.join(outputDir, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(cashFlowData, null, 2));
      console.log(`\nSaved to: ${fileName}`);
      
      // Display summary
      console.log('\n--- Cash Flow Summary ---');
      console.log(`Operating Activities: ${cashFlowData.operatingActivities?.netCashFromOperating || 0}`);
      console.log(`Investing Activities: ${cashFlowData.investingActivities?.netCashFromInvesting || 0}`);
      console.log(`Financing Activities: ${cashFlowData.financingActivities?.netCashFromFinancing || 0}`);
      console.log(`Net Cash Flow: ${cashFlowData.summary?.netCashFlow || 0}`);
      
      console.log('\n--- Key Differences from Bank Summary ---');
      console.log('✓ Shows WHY money moved (business activities)');
      console.log('✓ Categorized by Operating, Investing, Financing');
      console.log('✓ Includes receipts from customers, payments to suppliers');
      console.log('✗ No longer shows individual bank account movements');
      console.log('✗ No longer shows foreign exchange gains per account');
      
    } catch (error: any) {
      console.error('\n✗ Error fetching Cash Flow Statement:', error.message);
      
      if (error.message.includes('getReportCashflowStatement')) {
        console.log('\nPossible causes:');
        console.log('1. The Xero API endpoint might not be available');
        console.log('2. The date range might not have data');
        console.log('3. Permissions issue with Xero connection');
      }
      
      // Try to fetch Bank Summary as fallback
      console.log('\nTrying Bank Summary as fallback...');
      try {
        const { fetchDetailedCashSummary } = XeroReportFetcher as any;
        if (fetchDetailedCashSummary) {
          const bankSummary = await fetchDetailedCashSummary(tenantId, fromDate, toDate);
          console.log('✓ Bank Summary available as fallback');
          console.log(`  Accounts: ${bankSummary.accounts?.length || 0}`);
          console.log(`  Total Movement: ${bankSummary.totalCashMovement || 0}`);
        }
      } catch (fallbackError) {
        console.log('✗ Bank Summary also failed');
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the test
if (require.main === module) {
  testCashFlowFetcher()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}