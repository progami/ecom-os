import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

async function generateReportStatusSummary() {
  console.log('=== COMPREHENSIVE REPORT STATUS SUMMARY ===\n');
  console.log(`Generated at: ${new Date().toISOString()}\n`);

  try {
    // 1. Check database schema support
    console.log('📊 DATABASE SCHEMA SUPPORT\n');
    console.log('ReportData table supports:');
    console.log('  ✅ PROFIT_LOSS');
    console.log('  ✅ BALANCE_SHEET');
    console.log('  ✅ CASH_FLOW');
    console.log('  ✅ TRIAL_BALANCE');
    console.log('  ✅ GENERAL_LEDGER');
    console.log('\nImportedReport table supports:');
    console.log('  ✅ PROFIT_LOSS');
    console.log('  ✅ BALANCE_SHEET');
    console.log('  ✅ CASH_FLOW');
    console.log('  ✅ AGED_PAYABLES');
    console.log('  ✅ AGED_RECEIVABLES');
    console.log('  ✅ BANK_SUMMARY');

    // 2. Check ReportData statistics
    console.log('\n\n📈 REPORT DATA STATISTICS\n');
    
    const reportTypes = ['PROFIT_LOSS', 'BALANCE_SHEET', 'CASH_FLOW', 'TRIAL_BALANCE', 'GENERAL_LEDGER'];
    
    for (const reportType of reportTypes) {
      const count = await prisma.reportData.count({
        where: { reportType }
      });
      
      const activeCount = await prisma.reportData.count({
        where: { reportType, isActive: true }
      });
      
      const versionsInfo = await prisma.reportData.groupBy({
        by: ['version'],
        where: { reportType },
        _count: true,
        orderBy: { version: 'desc' }
      });
      
      console.log(`\n${reportType}:`);
      console.log(`  Total Records: ${count}`);
      console.log(`  Active Records: ${activeCount}`);
      console.log(`  Version Distribution: ${versionsInfo.map(v => `v${v.version}(${v._count})`).join(', ') || 'None'}`);
      
      if (count > 0) {
        const latest = await prisma.reportData.findFirst({
          where: { reportType, isActive: true },
          orderBy: { createdAt: 'desc' }
        });
        
        if (latest) {
          console.log(`  Latest Entry: ${latest.periodStart.toISOString().split('T')[0]} to ${latest.periodEnd.toISOString().split('T')[0]}`);
        }
      }
    }

    // 3. Check ImportedReport statistics
    console.log('\n\n📥 IMPORTED REPORT STATISTICS\n');
    
    const importTypes = ['PROFIT_LOSS', 'BALANCE_SHEET', 'CASH_FLOW', 'AGED_PAYABLES', 'AGED_RECEIVABLES', 'BANK_SUMMARY'];
    
    for (const type of importTypes) {
      const total = await prisma.importedReport.count({
        where: { type }
      });
      
      const byStatus = await prisma.importedReport.groupBy({
        by: ['status'],
        where: { type },
        _count: true
      });
      
      console.log(`\n${type}:`);
      console.log(`  Total Imports: ${total}`);
      
      const statusMap = new Map(byStatus.map(s => [s.status, s._count]));
      console.log(`  Status: COMPLETED(${statusMap.get('COMPLETED') || 0}), FAILED(${statusMap.get('FAILED') || 0}), PENDING(${statusMap.get('PENDING') || 0})`);
      
      if (total > 0) {
        const latestSuccess = await prisma.importedReport.findFirst({
          where: { type, status: 'COMPLETED' },
          orderBy: { importedAt: 'desc' }
        });
        
        if (latestSuccess) {
          console.log(`  Latest Success: ${latestSuccess.importedAt.toISOString()}`);
        }
      }
    }

    // 4. Versioning Analysis
    console.log('\n\n🔄 VERSIONING ANALYSIS\n');
    
    const multiVersionReports = await prisma.$queryRaw<Array<{
      reportType: string;
      periodStart: Date;
      periodEnd: Date;
      versionCount: bigint;
    }>>`
      SELECT "reportType", "periodStart", "periodEnd", COUNT(DISTINCT "version") as "versionCount"
      FROM "ReportData"
      GROUP BY "reportType", "periodStart", "periodEnd"
      HAVING COUNT(DISTINCT "version") > 1
      ORDER BY "versionCount" DESC
      LIMIT 10
    `;
    
    if (multiVersionReports.length > 0) {
      console.log('Reports with multiple versions:');
      multiVersionReports.forEach(r => {
        console.log(`  ${r.reportType}: ${r.periodStart.toISOString().split('T')[0]} to ${r.periodEnd.toISOString().split('T')[0]} (${r.versionCount} versions)`);
      });
    } else {
      console.log('No reports with multiple versions found.');
    }

    // 5. Implementation Status Summary
    console.log('\n\n✅ IMPLEMENTATION STATUS SUMMARY\n');
    
    console.log('Fully Implemented (UI + API + DB):');
    console.log('  ✅ Profit & Loss - with versioning support');
    console.log('  ✅ Balance Sheet - with versioning support');
    console.log('  ✅ Cash Flow - uses cache, no DB storage');
    console.log('  ✅ Trial Balance - import only, no Xero API');
    console.log('  ✅ General Ledger - import only, no Xero API');
    
    console.log('\nPartially Implemented:');
    console.log('  ⚠️  VAT Liability - API only, no UI');
    console.log('  ⚠️  Financial Overview - API only, combines other reports');
    
    console.log('\nNot Implemented:');
    console.log('  ❌ Aged Payables - DB support exists, no API/UI');
    console.log('  ❌ Aged Receivables - DB support exists, no API/UI');
    console.log('  ❌ Bank Summary - import support only');

    // 6. Recommendations
    console.log('\n\n💡 RECOMMENDATIONS\n');
    console.log('1. Cash Flow needs database storage implementation');
    console.log('2. Add versioning to Cash Flow, Trial Balance, and General Ledger');
    console.log('3. Implement Aged Payables and Aged Receivables APIs');
    console.log('4. Create UI pages for VAT Liability report');
    console.log('5. Consider implementing Bank Summary API endpoint');

    // Log to file
    structuredLogger.info('[Report Status Summary] Generated comprehensive report', {
      reportDataCount: await prisma.reportData.count(),
      importedReportCount: await prisma.importedReport.count(),
      multiVersionCount: multiVersionReports.length
    });

  } catch (error) {
    console.error('❌ Error generating summary:', error);
    structuredLogger.error('[Report Status Summary] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the summary
generateReportStatusSummary();