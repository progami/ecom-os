#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';
import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { getTenantId } from '../lib/xero-helpers';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

async function importCashFlowStatementsToDatabase() {
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    console.log('=== Importing Cash Flow Statements to Database ===\n');

    // Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID found - please connect to Xero first');
    }

    // Get user for importedBy
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null }
      }
    });

    if (!user) {
      throw new Error('No user with Xero connection found');
    }

    // Define the months to import (last 12 months)
    const monthsToImport = [];
    const now = new Date();
    
    for (let i = 1; i <= 12; i++) {
      const date = subMonths(now, i);
      monthsToImport.push({
        fromDate: startOfMonth(date),
        toDate: endOfMonth(date),
        label: format(date, 'MMMM yyyy')
      });
    }

    console.log(`Planning to import ${monthsToImport.length} months of Cash Flow Statements\n`);

    // Process each month
    for (const month of monthsToImport) {
      try {
        console.log(`Importing ${month.label}...`);

        // Check if we already have data for this period
        const existingReportData = await prisma.reportData.findFirst({
          where: {
            reportType: 'CASH_FLOW',
            periodStart: month.fromDate,
            periodEnd: month.toDate,
            isActive: true,
            // Check if it's the new format (has operatingActivities)
            data: {
              path: '$.operatingActivities',
              not: 'null'
            }
          }
        });

        if (existingReportData) {
          console.log(`✓ Already have Cash Flow Statement for ${month.label}`);
          successCount++;
          continue;
        }

        // Fetch the Cash Flow Statement from Xero
        const cashFlowData = await XeroReportFetcher.fetchCashFlowStatement(
          tenantId,
          month.fromDate,
          month.toDate
        );

        // Create ImportedReport record
        const importedReport = await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            source: 'API',
            periodStart: month.fromDate,
            periodEnd: month.toDate,
            importedBy: 'System Import - Cash Flow Statement',
            status: 'COMPLETED',
            recordCount: 3, // Operating, Investing, Financing sections
            fileName: `cash-flow-statement-${format(month.fromDate, 'yyyy-MM')}.json`,
            processedData: JSON.stringify(cashFlowData),
            metadata: JSON.stringify({
              reportName: 'Cash Flow Statement',
              month: month.label,
              netCashFlow: cashFlowData.summary?.netCashFlow || 0,
              operatingCashFlow: cashFlowData.operatingActivities?.netCashFromOperating || 0,
              investingCashFlow: cashFlowData.investingActivities?.netCashFromInvesting || 0,
              financingCashFlow: cashFlowData.financingActivities?.netCashFromFinancing || 0,
              fetchedAt: new Date().toISOString()
            })
          }
        });

        // Check if we need to deactivate old bank summary data
        const oldBankSummaryData = await prisma.reportData.findFirst({
          where: {
            reportType: 'CASH_FLOW',
            periodStart: month.fromDate,
            periodEnd: month.toDate,
            isActive: true,
            // Check if it's the old format (has detailedCashSummary)
            data: {
              path: '$.detailedCashSummary',
              not: 'null'
            }
          }
        });

        if (oldBankSummaryData) {
          // Deactivate the old bank summary
          await prisma.reportData.update({
            where: { id: oldBankSummaryData.id },
            data: {
              isActive: false,
              updatedAt: new Date()
            }
          });
          console.log(`  ✓ Deactivated old bank summary data`);
        }

        // Create new ReportData record with proper Cash Flow Statement
        await prisma.reportData.create({
          data: {
            reportType: 'CASH_FLOW',
            periodStart: month.fromDate,
            periodEnd: month.toDate,
            data: JSON.stringify(cashFlowData),
            summary: `Cash Flow Statement for ${month.label}: ` +
                    `Operating ${cashFlowData.operatingActivities?.netCashFromOperating || 0}, ` +
                    `Investing ${cashFlowData.investingActivities?.netCashFromInvesting || 0}, ` +
                    `Financing ${cashFlowData.financingActivities?.netCashFromFinancing || 0}, ` +
                    `Net Flow ${cashFlowData.summary?.netCashFlow || 0}`,
            version: 1,
            isActive: true,
            importedReportId: importedReport.id
          }
        });

        console.log(`✓ Imported Cash Flow Statement for ${month.label}`);
        console.log(`  Operating: ${cashFlowData.operatingActivities?.netCashFromOperating || 0}`);
        console.log(`  Investing: ${cashFlowData.investingActivities?.netCashFromInvesting || 0}`);
        console.log(`  Financing: ${cashFlowData.financingActivities?.netCashFromFinancing || 0}`);
        console.log(`  Net Cash Flow: ${cashFlowData.summary?.netCashFlow || 0}`);
        
        successCount++;

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`✗ Failed to import ${month.label}:`, error.message);
        errorCount++;
        
        if (error.message.includes('No cash flow statement data')) {
          console.log(`  Note: No data available for ${month.label} in Xero`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log('\n=== Import Summary ===');
    console.log(`Total months processed: ${monthsToImport.length}`);
    console.log(`Successful imports: ${successCount}`);
    console.log(`Failed imports: ${errorCount}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);

    // Log statistics about the imported data
    const stats = await prisma.reportData.aggregate({
      where: {
        reportType: 'CASH_FLOW',
        isActive: true,
        data: {
          path: '$.operatingActivities',
          not: 'null'
        }
      },
      _count: true
    });

    console.log(`\nTotal Cash Flow Statements in database: ${stats._count}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  importCashFlowStatementsToDatabase()
    .then(() => {
      console.log('\n=== Import completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}