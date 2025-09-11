import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function delete2024PLData() {
  console.log('🗑️  Deleting 2024 P&L data...');
  
  // Get start and end dates for 2024
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  
  // Delete ReportData entries for 2024
  const deletedReportData = await prisma.reportData.deleteMany({
    where: {
      reportType: 'PROFIT_LOSS',
      periodStart: {
        gte: startDate
      },
      periodEnd: {
        lte: endDate
      }
    }
  });
  
  // Delete ImportedReport entries for 2024
  const deletedImportedReports = await prisma.importedReport.deleteMany({
    where: {
      type: 'PROFIT_LOSS',
      periodStart: {
        gte: startDate
      },
      periodEnd: {
        lte: endDate
      }
    }
  });
  
  console.log(`✅ Deleted ${deletedReportData.count} ReportData entries for 2024`);
  console.log(`✅ Deleted ${deletedImportedReports.count} ImportedReport entries for 2024`);
}

// Run deletion
delete2024PLData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());