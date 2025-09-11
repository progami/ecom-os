#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { ReportDatabaseFetcher } from '../lib/report-database-fetcher';

async function testCashFlowData() {
  try {
    console.log('=== Testing Cash Flow Data Retrieval ===\n');

    // Test fetching for a specific month
    const testCases = [
      { month: 'Feb 2021', start: new Date(2021, 1, 1), end: new Date(2021, 2, 0) },
      { month: 'Jun 2024', start: new Date(2024, 5, 1), end: new Date(2024, 6, 0) },
      { month: 'Current Month', start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() }
    ];

    for (const testCase of testCases) {
      console.log(`\nTesting ${testCase.month}:`);
      console.log(`From: ${testCase.start.toISOString().split('T')[0]}`);
      console.log(`To: ${testCase.end.toISOString().split('T')[0]}`);

      // Test database fetcher
      const data = await ReportDatabaseFetcher.fetchCashFlow(testCase.start, testCase.end);
      
      if (data && data.detailedCashSummary) {
        console.log('✓ Data found!');
        console.log(`  - Accounts: ${data.detailedCashSummary.accounts?.length || 0}`);
        console.log(`  - Opening Balance: ${data.detailedCashSummary.openingBalance}`);
        console.log(`  - Total Movement: ${data.detailedCashSummary.totalCashMovement}`);
        console.log(`  - Closing Balance: ${data.detailedCashSummary.closingBalance}`);
        
        if (data.detailedCashSummary.accounts?.length > 0) {
          console.log('  - First Account:', data.detailedCashSummary.accounts[0].accountName);
        }
      } else {
        console.log('✗ No data found');
      }
    }

    // Count total records
    const totalReports = await prisma.reportData.count({
      where: { reportType: 'CASH_FLOW' }
    });
    
    const totalImports = await prisma.importedReport.count({
      where: { type: 'CASH_FLOW' }
    });

    console.log('\n=== Database Summary ===');
    console.log(`Total Cash Flow Reports: ${totalReports}`);
    console.log(`Total Import Records: ${totalImports}`);

    // Get date range
    const firstReport = await prisma.reportData.findFirst({
      where: { reportType: 'CASH_FLOW' },
      orderBy: { periodStart: 'asc' }
    });
    
    const lastReport = await prisma.reportData.findFirst({
      where: { reportType: 'CASH_FLOW' },
      orderBy: { periodEnd: 'desc' }
    });

    if (firstReport && lastReport) {
      console.log(`Date Range: ${firstReport.periodStart.toISOString().split('T')[0]} to ${lastReport.periodEnd.toISOString().split('T')[0]}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testCashFlowData()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}