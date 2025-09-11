import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearYear2024Data() {
  console.log('🧹 Clearing Year 2024 P&L data...');
  
  try {
    // Delete ReportData entries for full year 2024
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: new Date('2024-01-01T06:00:00.000Z'),
        periodEnd: new Date('2024-12-31T06:00:00.000Z')
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} ReportData entries`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearYear2024Data();