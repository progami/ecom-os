#!/usr/bin/env ts-node

import { ReportDatabaseFetcher } from '../lib/report-database-fetcher';
import { prisma } from '../lib/prisma';

async function testFeb2021Query() {
  try {
    console.log('=== Testing Feb 2021 Query ===\n');

    // Create exact dates for Feb 2021
    const startDate = new Date('2021-02-01');
    const endDate = new Date('2021-02-28');
    
    console.log('Query dates:');
    console.log(`Start: ${startDate.toISOString()}`);
    console.log(`End: ${endDate.toISOString()}`);

    // Use the ReportDatabaseFetcher
    console.log('\n=== Using ReportDatabaseFetcher ===');
    const data = await ReportDatabaseFetcher.fetchCashFlow(startDate, endDate);
    
    if (data) {
      console.log('✓ Data found!');
      if (data.detailedCashSummary) {
        console.log('  Has detailed cash summary');
        console.log(`  Accounts: ${data.detailedCashSummary.accounts?.length || 0}`);
        console.log(`  Total Movement: ${data.detailedCashSummary.totalCashMovement}`);
      } else {
        console.log('  No detailed cash summary');
      }
    } else {
      console.log('✗ No data found');
    }

    // Direct query to see what's happening
    console.log('\n=== Direct Database Query ===');
    const directQuery = await prisma.reportData.findFirst({
      where: {
        reportType: 'CASH_FLOW',
        periodStart: { lte: endDate },
        periodEnd: { gte: startDate },
        isActive: true
      },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        summary: true,
        data: true
      }
    });

    if (directQuery) {
      console.log('✓ Found report:');
      console.log(`  ID: ${directQuery.id}`);
      console.log(`  Period: ${directQuery.periodStart.toISOString()} to ${directQuery.periodEnd.toISOString()}`);
      console.log(`  Has Summary: ${directQuery.summary !== null}`);
      
      // Check if it has detailed cash summary
      const parsedData = JSON.parse(directQuery.data);
      console.log(`  Has Detailed Cash Summary: ${!!parsedData.detailedCashSummary}`);
      
      if (!parsedData.detailedCashSummary) {
        console.log('\n  >>> This is likely the old report without cash summary data!');
      }
    }

    // Query specifically for reports with summaries
    console.log('\n=== Query for Reports with Summaries ===');
    const withSummaryQuery = await prisma.reportData.findFirst({
      where: {
        reportType: 'CASH_FLOW',
        periodStart: { lte: endDate },
        periodEnd: { gte: startDate },
        isActive: true,
        summary: { not: null }
      },
      orderBy: { version: 'desc' }
    });

    if (withSummaryQuery) {
      console.log('✓ Found report with summary:');
      console.log(`  ID: ${withSummaryQuery.id}`);
      console.log(`  Summary: ${withSummaryQuery.summary?.substring(0, 80)}...`);
    } else {
      console.log('✗ No report with summary found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testFeb2021Query()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}