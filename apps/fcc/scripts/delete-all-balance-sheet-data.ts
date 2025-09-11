import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

async function deleteAllBalanceSheetData() {
  console.log('🗑️  DELETING ALL BALANCE SHEET DATA\n');
  console.log('This will delete:');
  console.log('  - All Balance Sheet entries from ReportData table');
  console.log('  - All Balance Sheet entries from ImportedReport table\n');
  
  try {
    // 1. Delete all Balance Sheet data from ReportData
    console.log('Deleting from ReportData table...');
    const deletedReportData = await prisma.reportData.deleteMany({
      where: {
        reportType: 'BALANCE_SHEET'
      }
    });
    console.log(`✅ Deleted ${deletedReportData.count} Balance Sheet entries from ReportData`);
    
    // 2. Delete all Balance Sheet imports from ImportedReport
    console.log('\nDeleting from ImportedReport table...');
    const deletedImports = await prisma.importedReport.deleteMany({
      where: {
        type: 'BALANCE_SHEET'
      }
    });
    console.log(`✅ Deleted ${deletedImports.count} Balance Sheet entries from ImportedReport`);
    
    // 3. Summary
    console.log('\n=== DELETION SUMMARY ===');
    console.log(`Total ReportData entries deleted: ${deletedReportData.count}`);
    console.log(`Total ImportedReport entries deleted: ${deletedImports.count}`);
    console.log(`\n✅ All Balance Sheet data has been cleared!`);
    
    // Log to development.log
    structuredLogger.info('[Balance Sheet Cleanup] Deleted all Balance Sheet data', {
      reportDataDeleted: deletedReportData.count,
      importedReportDeleted: deletedImports.count
    });
    
  } catch (error) {
    console.error('❌ Error deleting data:', error);
    structuredLogger.error('[Balance Sheet Cleanup] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deletion
deleteAllBalanceSheetData();