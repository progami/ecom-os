#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';

async function findDuplicateCashFlowReports() {
  try {
    console.log('=== Finding Duplicate Cash Flow Reports ===\n');

    // Get all cash flow reports
    const allReports = await prisma.reportData.findMany({
      where: {
        reportType: 'CASH_FLOW'
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        summary: true,
        createdAt: true,
        importedReportId: true
      },
      orderBy: {
        periodStart: 'asc'
      }
    });

    // Group by month to find duplicates
    const reportsByMonth = new Map<string, typeof allReports>();

    allReports.forEach(report => {
      const monthKey = report.periodStart.toISOString().substring(0, 7); // YYYY-MM
      if (!reportsByMonth.has(monthKey)) {
        reportsByMonth.set(monthKey, []);
      }
      reportsByMonth.get(monthKey)!.push(report);
    });

    // Find months with duplicates
    let duplicateCount = 0;
    let reportsToDelete: string[] = [];

    reportsByMonth.forEach((reports, month) => {
      if (reports.length > 1) {
        duplicateCount++;
        console.log(`\n${month} has ${reports.length} reports:`);
        
        reports.forEach(report => {
          const hasSummary = report.summary !== null && report.summary !== 'null';
          const hasImportId = report.importedReportId !== null;
          
          console.log(`  ID: ${report.id}`);
          console.log(`    Period: ${report.periodStart.toISOString()} to ${report.periodEnd.toISOString()}`);
          console.log(`    Has Summary: ${hasSummary}`);
          console.log(`    Has Import ID: ${hasImportId}`);
          console.log(`    Created: ${report.createdAt.toISOString()}`);
          
          // Mark reports without summary and without import ID for deletion
          if (!hasSummary && !hasImportId) {
            reportsToDelete.push(report.id);
            console.log(`    >>> MARKED FOR DELETION`);
          }
        });
      }
    });

    console.log(`\n=== Summary ===`);
    console.log(`Total reports: ${allReports.length}`);
    console.log(`Months with duplicates: ${duplicateCount}`);
    console.log(`Reports to delete: ${reportsToDelete.length}`);

    if (reportsToDelete.length > 0) {
      console.log('\n=== Deleting duplicate reports without data ===');
      
      const deleteResult = await prisma.reportData.deleteMany({
        where: {
          id: {
            in: reportsToDelete
          }
        }
      });
      
      console.log(`✓ Deleted ${deleteResult.count} duplicate reports`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  findDuplicateCashFlowReports()
    .then(() => {
      console.log('\n=== Cleanup completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}