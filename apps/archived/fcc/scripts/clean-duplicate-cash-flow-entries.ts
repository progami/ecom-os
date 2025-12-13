#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';

async function cleanDuplicateCashFlowEntries() {
  try {
    console.log('=== Cleaning Duplicate Cash Flow Entries ===\n');

    // Get all cash flow reports grouped by month
    const allReports = await prisma.reportData.findMany({
      where: {
        reportType: 'CASH_FLOW'
      },
      orderBy: [
        { periodStart: 'asc' },
        { createdAt: 'desc' } // Newest first within each period
      ]
    });

    // Group by month key (YYYY-MM from periodStart)
    const reportsByMonth = new Map<string, typeof allReports>();
    
    allReports.forEach(report => {
      const monthKey = report.periodStart.toISOString().substring(0, 7);
      if (!reportsByMonth.has(monthKey)) {
        reportsByMonth.set(monthKey, []);
      }
      reportsByMonth.get(monthKey)!.push(report);
    });

    // Find duplicates and determine which to keep
    const idsToDelete: string[] = [];
    let keptCount = 0;
    
    console.log('Processing duplicates by month:\n');
    
    reportsByMonth.forEach((reports, month) => {
      if (reports.length > 1) {
        console.log(`${month}: Found ${reports.length} entries`);
        
        // Sort by priority: 
        // 1. Has summary (not null)
        // 2. Has detailed cash summary in data
        // 3. Most recently created
        const sortedReports = reports.sort((a, b) => {
          // Check if has summary
          const aHasSummary = a.summary !== null && a.summary !== 'null';
          const bHasSummary = b.summary !== null && b.summary !== 'null';
          
          if (aHasSummary && !bHasSummary) return -1;
          if (!aHasSummary && bHasSummary) return 1;
          
          // Check if has detailed cash summary
          try {
            const aData = JSON.parse(a.data);
            const bData = JSON.parse(b.data);
            const aHasDetailed = !!aData.detailedCashSummary;
            const bHasDetailed = !!bData.detailedCashSummary;
            
            if (aHasDetailed && !bHasDetailed) return -1;
            if (!aHasDetailed && bHasDetailed) return 1;
          } catch (e) {
            // If JSON parse fails, continue
          }
          
          // Finally, sort by creation date (newest first)
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        // Keep the first one (best according to our criteria)
        const keeper = sortedReports[0];
        console.log(`  Keeping: ${keeper.id} (created: ${keeper.createdAt.toISOString()})`);
        
        if (keeper.summary) {
          console.log(`    Summary: ${keeper.summary.substring(0, 60)}...`);
        }
        
        keptCount++;
        
        // Mark the rest for deletion
        for (let i = 1; i < sortedReports.length; i++) {
          const toDelete = sortedReports[i];
          idsToDelete.push(toDelete.id);
          console.log(`  Deleting: ${toDelete.id} (created: ${toDelete.createdAt.toISOString()})`);
        }
        
        console.log('');
      } else {
        keptCount++;
      }
    });

    // Also clean up corresponding ImportedReport entries
    console.log('\n=== Cleaning ImportedReport Entries ===');
    
    // Get all imported reports that don't have corresponding ReportData
    const orphanedImports = await prisma.importedReport.findMany({
      where: {
        type: 'CASH_FLOW',
        reportData: {
          none: {}
        }
      }
    });
    
    console.log(`Found ${orphanedImports.length} orphaned ImportedReport entries`);

    // Delete duplicate ReportData entries
    if (idsToDelete.length > 0) {
      console.log(`\n=== Deleting ${idsToDelete.length} duplicate ReportData entries ===`);
      
      const deleteResult = await prisma.reportData.deleteMany({
        where: {
          id: {
            in: idsToDelete
          }
        }
      });
      
      console.log(`✓ Deleted ${deleteResult.count} duplicate entries`);
    }

    // Delete orphaned ImportedReport entries
    if (orphanedImports.length > 0) {
      const orphanIds = orphanedImports.map(imp => imp.id);
      
      const deleteImportsResult = await prisma.importedReport.deleteMany({
        where: {
          id: {
            in: orphanIds
          }
        }
      });
      
      console.log(`✓ Deleted ${deleteImportsResult.count} orphaned import entries`);
    }

    // Final summary
    console.log('\n=== Final Summary ===');
    console.log(`Total unique months: ${reportsByMonth.size}`);
    console.log(`Kept entries: ${keptCount}`);
    console.log(`Deleted entries: ${idsToDelete.length}`);
    
    // Verify final state
    const finalCount = await prisma.reportData.count({
      where: { reportType: 'CASH_FLOW' }
    });
    
    console.log(`\nFinal cash flow report count: ${finalCount}`);
    
    structuredLogger.info('Cleaned duplicate cash flow entries', {
      monthsProcessed: reportsByMonth.size,
      entriesDeleted: idsToDelete.length,
      entriesKept: keptCount,
      finalCount
    });

  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    structuredLogger.error('Failed to clean duplicate cash flow entries', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  cleanDuplicateCashFlowEntries()
    .then(() => {
      console.log('\n=== Cleanup completed successfully ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}