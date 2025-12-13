#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';

async function fixCashFlowDateQuery() {
  try {
    console.log('=== Analyzing Cash Flow Date Query Issue ===\n');

    // Test case: February 2021
    const testStart = new Date(2021, 1, 1); // Feb 1, 2021
    const testEnd = new Date(2021, 2, 0); // Feb 28, 2021

    console.log('Test Query Parameters:');
    console.log(`Start: ${testStart.toISOString()}`);
    console.log(`End: ${testEnd.toISOString()}`);

    // Check what's actually stored in the database
    const allCashFlowReports = await prisma.reportData.findMany({
      where: {
        reportType: 'CASH_FLOW'
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        summary: true
      },
      orderBy: {
        periodStart: 'asc'
      },
      take: 5 // First 5 reports
    });

    console.log('\n=== First 5 Cash Flow Reports in Database ===');
    allCashFlowReports.forEach(report => {
      console.log(`\nID: ${report.id}`);
      console.log(`Period Start: ${report.periodStart.toISOString()}`);
      console.log(`Period End: ${report.periodEnd.toISOString()}`);
      console.log(`Summary: ${report.summary?.substring(0, 50)}...`);
    });

    // Test the current query logic
    console.log('\n=== Testing Current Query Logic ===');
    const currentQuery = await prisma.reportData.findFirst({
      where: {
        reportType: 'CASH_FLOW',
        periodStart: { lte: testEnd },
        periodEnd: { gte: testStart },
        isActive: true
      },
      orderBy: { version: 'desc' }
    });

    if (currentQuery) {
      console.log('✓ Found with current logic');
      console.log(`  Period: ${currentQuery.periodStart.toISOString()} to ${currentQuery.periodEnd.toISOString()}`);
    } else {
      console.log('✗ Not found with current logic');
    }

    // Test exact match query
    console.log('\n=== Testing Exact Match Query ===');
    const exactQuery = await prisma.reportData.findFirst({
      where: {
        reportType: 'CASH_FLOW',
        periodStart: testStart,
        periodEnd: testEnd,
        isActive: true
      }
    });

    if (exactQuery) {
      console.log('✓ Found with exact match');
      console.log(`  Period: ${exactQuery.periodStart.toISOString()} to ${exactQuery.periodEnd.toISOString()}`);
    } else {
      console.log('✗ Not found with exact match');
    }

    // Find the Feb 2021 report by looking at the data
    console.log('\n=== Searching for Feb 2021 Report ===');
    const feb2021Report = await prisma.reportData.findFirst({
      where: {
        reportType: 'CASH_FLOW',
        OR: [
          {
            periodStart: {
              gte: new Date('2021-02-01T00:00:00Z'),
              lt: new Date('2021-03-01T00:00:00Z')
            }
          },
          {
            summary: {
              contains: 'Feb 2021'
            }
          }
        ]
      }
    });

    if (feb2021Report) {
      console.log('✓ Found Feb 2021 report');
      console.log(`  ID: ${feb2021Report.id}`);
      console.log(`  Period Start: ${feb2021Report.periodStart.toISOString()}`);
      console.log(`  Period End: ${feb2021Report.periodEnd.toISOString()}`);
      console.log(`  Summary: ${feb2021Report.summary}`);
      
      // Parse the data to check the actual dates
      const data = JSON.parse(feb2021Report.data);
      if (data.detailedCashSummary) {
        console.log('\n  Detailed Cash Summary Dates:');
        console.log(`    From Date: ${data.detailedCashSummary.fromDate}`);
        console.log(`    To Date: ${data.detailedCashSummary.toDate}`);
      }
    } else {
      console.log('✗ Feb 2021 report not found');
    }

    // Check for timezone issues
    console.log('\n=== Checking for Timezone Issues ===');
    const importedReport = await prisma.importedReport.findFirst({
      where: {
        type: 'CASH_FLOW',
        metadata: {
          contains: '"month":"Feb 2021"'
        }
      }
    });

    if (importedReport) {
      console.log('✓ Found imported report for Feb 2021');
      console.log(`  Period Start: ${importedReport.periodStart.toISOString()}`);
      console.log(`  Period End: ${importedReport.periodEnd.toISOString()}`);
      console.log(`  Metadata: ${importedReport.metadata}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  fixCashFlowDateQuery()
    .then(() => {
      console.log('\n=== Analysis completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}