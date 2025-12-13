import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDecemberData() {
  console.log('🧹 Clearing December 2024 P&L data...');
  
  try {
    // Delete ReportData entries for December 2024
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: new Date('2024-12-01T06:00:00.000Z'),
        periodEnd: new Date('2024-12-31T06:00:00.000Z')
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} ReportData entries`);
    
    // Also check ImportedReport entries
    const importedReports = await prisma.importedReport.findMany({
      where: {
        type: 'PROFIT_LOSS',
        periodStart: new Date('2024-12-01T06:00:00.000Z'),
        periodEnd: new Date('2024-12-31T06:00:00.000Z')
      },
      select: {
        id: true,
        status: true,
        source: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Found ${importedReports.length} ImportedReport entries for December 2024:`);
    importedReports.forEach(report => {
      console.log(`  - ${report.id}: ${report.source} (${report.status}) - ${report.createdAt.toISOString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDecemberData();