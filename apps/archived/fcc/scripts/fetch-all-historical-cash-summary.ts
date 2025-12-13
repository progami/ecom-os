#!/usr/bin/env ts-node

import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';
import { startOfMonth, endOfMonth, format, addMonths } from 'date-fns';
import fs from 'fs';
import path from 'path';

async function fetchAllHistoricalCashSummary() {
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  const errors: any[] = [];

  try {
    // Get tenant ID from the first user with Xero connection
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null }
      }
    });

    if (!user || !user.tenantId) {
      throw new Error('No user with Xero connection found');
    }

    const tenantId = user.tenantId;
    console.log(`Using tenant ID: ${tenantId}`);
    console.log(`Tenant Name: ${user.tenantName}`);

    // Create output directory
    const outputDir = path.join(process.cwd(), 'data', 'cash-summaries');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Start from February 2021
    let currentDate = new Date(2021, 1, 1); // February 2021
    const endDate = new Date(); // Current date

    const allData: any[] = [];

    while (currentDate <= endDate) {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const monthLabel = format(monthStart, 'MMM yyyy');

      try {
        console.log(`\nFetching cash summary for ${monthLabel}...`);
        
        // Add delay to avoid rate limiting
        if (successCount > 0 && successCount % 5 === 0) {
          console.log('Pausing for 5 seconds to avoid rate limiting...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Fetch detailed cash summary using Bank Summary report
        const cashSummary = await XeroReportFetcher.fetchDetailedCashSummary(
          tenantId,
          monthStart,
          monthEnd
        );

        // Add metadata
        const dataWithMeta = {
          ...cashSummary,
          month: monthLabel,
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString(),
          fetchedAt: new Date().toISOString()
        };

        allData.push(dataWithMeta);

        // Save individual month file
        const monthFileName = `cash-summary-${format(monthStart, 'yyyy-MM')}.json`;
        const monthFilePath = path.join(outputDir, monthFileName);
        fs.writeFileSync(monthFilePath, JSON.stringify(dataWithMeta, null, 2));
        
        console.log(`✓ Saved ${monthLabel} to ${monthFileName}`);
        console.log(`  - Accounts: ${cashSummary.accounts?.length || 0}`);
        console.log(`  - Total Movement: ${cashSummary.totalCashMovement || 0}`);
        console.log(`  - Closing Balance: ${cashSummary.closingBalance || 0}`);
        
        successCount++;

        // Also save to database if needed
        if (cashSummary.accounts && cashSummary.accounts.length > 0) {
          try {
            await prisma.reportData.create({
              data: {
                reportType: 'CASH_SUMMARY',
                periodStart: monthStart,
                periodEnd: monthEnd,
                data: JSON.stringify(dataWithMeta),
                source: 'XERO_API',
                version: 1,
                isActive: true
              }
            });
            console.log(`  ✓ Saved to database`);
          } catch (dbError) {
            console.error(`  ✗ Database save failed:`, dbError);
          }
        }

      } catch (error: any) {
        console.error(`✗ Error fetching ${monthLabel}:`, error.message);
        errors.push({
          month: monthLabel,
          error: error.message,
          stack: error.stack
        });
        errorCount++;
      }

      // Move to next month
      currentDate = addMonths(currentDate, 1);
    }

    // Save combined data
    const combinedFilePath = path.join(outputDir, 'all-cash-summaries.json');
    fs.writeFileSync(combinedFilePath, JSON.stringify({
      tenantId,
      tenantName: user.tenantName,
      startMonth: 'Feb 2021',
      endMonth: format(endDate, 'MMM yyyy'),
      totalMonths: allData.length,
      fetchedAt: new Date().toISOString(),
      data: allData
    }, null, 2));

    // Save error log if any
    if (errors.length > 0) {
      const errorLogPath = path.join(outputDir, 'fetch-errors.json');
      fs.writeFileSync(errorLogPath, JSON.stringify({
        errors,
        totalErrors: errorCount,
        timestamp: new Date().toISOString()
      }, null, 2));
    }

    // Generate summary CSV for easy viewing
    const csvPath = path.join(outputDir, 'cash-summary-overview.csv');
    const csvContent = [
      'Month,Opening Balance,Cash Received,Cash Spent,Net Movement,Closing Balance,Account Count',
      ...allData.map(d => {
        const totalReceived = d.accounts?.reduce((sum: number, acc: any) => sum + (acc.cashReceived || 0), 0) || 0;
        const totalSpent = d.accounts?.reduce((sum: number, acc: any) => sum + (acc.cashSpent || 0), 0) || 0;
        return `${d.month},${d.openingBalance || 0},${totalReceived},${totalSpent},${d.totalCashMovement || 0},${d.closingBalance || 0},${d.accounts?.length || 0}`;
      })
    ].join('\n');
    fs.writeFileSync(csvPath, csvContent);

    const duration = Date.now() - startTime;
    console.log('\n=== Summary ===');
    console.log(`Total months processed: ${successCount + errorCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`\nData saved to: ${outputDir}`);
    console.log(`Combined file: ${combinedFilePath}`);
    console.log(`CSV overview: ${csvPath}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  console.log('=== Fetching Historical Cash Summary Data ===');
  console.log('Period: February 2021 to Present');
  console.log('This will take several minutes...\n');
  
  fetchAllHistoricalCashSummary()
    .then(() => {
      console.log('\n=== Completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}