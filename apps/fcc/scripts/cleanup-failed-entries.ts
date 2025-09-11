import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

async function cleanupFailedEntries() {
  console.log('🧹 Starting cleanup of failed and redundant entries...\n');
  
  try {
    // 1. Delete failed ImportedReport entries
    const failedImports = await prisma.importedReport.deleteMany({
      where: {
        status: 'FAILED'
      }
    });
    
    console.log(`✅ Deleted ${failedImports.count} failed ImportedReport entries`);
    structuredLogger.info('[Cleanup] Deleted failed imports', { count: failedImports.count });
    
    // 2. Find and delete duplicate ReportData entries (keeping the latest version)
    const duplicates = await prisma.$queryRaw<Array<{
      reportType: string;
      periodStart: Date;
      periodEnd: Date;
      duplicateCount: bigint;
    }>>`
      SELECT "reportType", "periodStart", "periodEnd", COUNT(*) as "duplicateCount"
      FROM "ReportData"
      WHERE "reportType" = 'PROFIT_LOSS'
      GROUP BY "reportType", "periodStart", "periodEnd"
      HAVING COUNT(*) > 1
    `;
    
    console.log(`\n📊 Found ${duplicates.length} periods with duplicate entries`);
    
    let totalDuplicatesRemoved = 0;
    
    for (const dup of duplicates) {
      // Get all entries for this period
      const entries = await prisma.reportData.findMany({
        where: {
          reportType: dup.reportType,
          periodStart: dup.periodStart,
          periodEnd: dup.periodEnd
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      // Keep the latest version, delete the rest
      if (entries.length > 1) {
        const idsToDelete = entries.slice(1).map(e => e.id);
        
        const deleted = await prisma.reportData.deleteMany({
          where: {
            id: {
              in: idsToDelete
            }
          }
        });
        
        totalDuplicatesRemoved += deleted.count;
        console.log(`   Removed ${deleted.count} duplicates for ${dup.periodStart.toISOString().split('T')[0]} to ${dup.periodEnd.toISOString().split('T')[0]}`);
      }
    }
    
    console.log(`\n✅ Total duplicate entries removed: ${totalDuplicatesRemoved}`);
    structuredLogger.info('[Cleanup] Removed duplicate entries', { count: totalDuplicatesRemoved });
    
    // 3. Delete orphaned ImportedReport entries (no corresponding ReportData)
    const orphanedImports = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT ir.id
      FROM "ImportedReport" ir
      WHERE ir.type = 'PROFIT_LOSS'
      AND ir.status = 'SUCCESS'
      AND NOT EXISTS (
        SELECT 1 FROM "ReportData" rd
        WHERE rd."importedReportId" = ir.id
      )
    `;
    
    if (orphanedImports.length > 0) {
      const orphanIds = orphanedImports.map(o => o.id);
      const deletedOrphans = await prisma.importedReport.deleteMany({
        where: {
          id: {
            in: orphanIds
          }
        }
      });
      
      console.log(`\n✅ Deleted ${deletedOrphans.count} orphaned ImportedReport entries`);
      structuredLogger.info('[Cleanup] Deleted orphaned imports', { count: deletedOrphans.count });
    }
    
    // Summary
    console.log('\n=== CLEANUP SUMMARY ===');
    console.log(`Failed imports deleted: ${failedImports.count}`);
    console.log(`Duplicate entries removed: ${totalDuplicatesRemoved}`);
    console.log(`Orphaned imports deleted: ${orphanedImports.length}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    structuredLogger.error('[Cleanup] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupFailedEntries();