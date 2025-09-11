import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function deduplicateReports() {
  console.log('=== DEDUPLICATING IMPORTED REPORTS ===\n');
  
  try {
    // Process each report type
    const reportTypes = ['BALANCE_SHEET', 'PROFIT_LOSS', 'CASH_FLOW', 'TRIAL_BALANCE', 'GENERAL_LEDGER'];
    
    for (const reportType of reportTypes) {
      console.log(`\nProcessing ${reportType} reports...`);
      
      // Get all reports of this type, ordered by date
      const reports = await prisma.importedReport.findMany({
        where: { type: reportType },
        orderBy: [
          { periodStart: 'asc' },
          { periodEnd: 'asc' },
          { importedAt: 'desc' } // Most recent import first for same period
        ]
      });
      
      if (reports.length === 0) {
        console.log(`  No ${reportType} reports found`);
        continue;
      }
      
      // Group by unique period (periodStart + periodEnd)
      const periodMap = new Map<string, typeof reports>();
      
      for (const report of reports) {
        const periodKey = `${report.periodStart.toISOString()}_${report.periodEnd.toISOString()}`;
        
        if (!periodMap.has(periodKey)) {
          periodMap.set(periodKey, []);
        }
        periodMap.get(periodKey)!.push(report);
      }
      
      console.log(`  Found ${periodMap.size} unique periods with ${reports.length} total reports`);
      
      let duplicatesRemoved = 0;
      
      // For each period, keep only the most recent successful import
      for (const [periodKey, periodReports] of periodMap) {
        if (periodReports.length > 1) {
          // Sort by status (COMPLETED first) and then by dateTime (most recent first)
          periodReports.sort((a, b) => {
            if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return -1;
            if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return 1;
            return b.importedAt.getTime() - a.importedAt.getTime();
          });
          
          const keepReport = periodReports[0];
          const deleteReports = periodReports.slice(1);
          
          console.log(`\n  Period: ${keepReport.periodStart.toISOString().split('T')[0]} to ${keepReport.periodEnd.toISOString().split('T')[0]}`);
          console.log(`    Keeping: ID ${keepReport.id} (${keepReport.status}, imported ${keepReport.importedAt.toISOString()})`);
          console.log(`    Deleting ${deleteReports.length} duplicates`);
          
          // Delete associated ReportData entries first
          for (const report of deleteReports) {
            await prisma.reportData.deleteMany({
              where: { importedReportId: report.id }
            });
          }
          
          // Then delete the ImportedReport entries
          await prisma.importedReport.deleteMany({
            where: {
              id: { in: deleteReports.map(r => r.id) }
            }
          });
          
          duplicatesRemoved += deleteReports.length;
        }
      }
      
      console.log(`\n  Removed ${duplicatesRemoved} duplicate ${reportType} reports`);
    }
    
    // Log to development.log
    const logMessage = `\n[${new Date().toISOString()}] Report Deduplication Completed\n` +
      `  Processed report types: ${reportTypes.join(', ')}\n` +
      `  Check console output for detailed results\n`;
    
    fs.appendFileSync('development.log', logMessage);
    
    console.log('\n=== DEDUPLICATION COMPLETE ===');
    
    // Show final counts
    console.log('\nFinal report counts by type:');
    for (const reportType of reportTypes) {
      const count = await prisma.importedReport.count({
        where: { type: reportType }
      });
      console.log(`  ${reportType}: ${count} reports`);
    }
    
  } catch (error) {
    console.error('Error during deduplication:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deduplication
deduplicateReports();