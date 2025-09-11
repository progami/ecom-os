import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyCashFlowData() {
  console.log('=== VERIFYING CASH FLOW DATA IN DATABASE ===\n');
  
  try {
    // Check ImportedReport entries
    const importedReports = await prisma.importedReport.count({
      where: { 
        type: 'CASH_FLOW',
        status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] }
      }
    });
    
    const failedReports = await prisma.importedReport.count({
      where: { 
        type: 'CASH_FLOW',
        status: 'FAILED'
      }
    });
    
    console.log(`📊 ImportedReport Summary:`);
    console.log(`   Successful: ${importedReports}`);
    console.log(`   Failed: ${failedReports}`);
    
    // Check ReportData entries
    const reportData = await prisma.reportData.count({
      where: { 
        reportType: 'CASH_FLOW',
        isActive: true
      }
    });
    
    console.log(`\n📊 ReportData Summary:`);
    console.log(`   Active Cash Flow Reports: ${reportData}`);
    
    // Get sample of recent cash flow data
    const recentData = await prisma.reportData.findMany({
      where: { 
        reportType: 'CASH_FLOW',
        isActive: true
      },
      orderBy: { periodStart: 'desc' },
      take: 5
    });
    
    console.log(`\n📋 Recent Cash Flow Reports:`);
    for (const report of recentData) {
      const data = JSON.parse(report.data);
      const period = `${report.periodStart.toISOString().split('T')[0]} to ${report.periodEnd.toISOString().split('T')[0]}`;
      console.log(`\n   Period: ${period}`);
      console.log(`   Opening Balance: £${data.summary?.openingBalance || 0}`);
      console.log(`   Operating Activities: £${data.operatingActivities?.netCashFromOperating || 0}`);
      console.log(`   Net Cash Flow: £${data.summary?.netCashFlow || 0}`);
      console.log(`   Closing Balance: £${data.summary?.closingBalance || 0}`);
    }
    
    // Check for zero values
    const zeroValueReports = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) as count 
      FROM ReportData 
      WHERE reportType = 'CASH_FLOW' 
        AND isActive = true
        AND data LIKE '%"netCashFlow":0%'
        AND data LIKE '%"openingBalance":0%'
        AND data LIKE '%"closingBalance":0%'
    `;
    
    console.log(`\n⚠️  Reports with all zero values: ${zeroValueReports[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyCashFlowData()
  .then(() => console.log('\n✅ Verification completed'))
  .catch(error => console.error('Verification failed:', error));