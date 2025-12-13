import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAll2024PLData() {
  console.log('🧹 Clearing all 2024 P&L data...');
  
  try {
    // Delete all ReportData entries for 2024
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'PROFIT_LOSS',
        OR: [
          {
            periodStart: {
              gte: new Date('2024-01-01T00:00:00.000Z'),
              lt: new Date('2025-01-01T00:00:00.000Z')
            }
          },
          {
            periodEnd: {
              gte: new Date('2024-01-01T00:00:00.000Z'),
              lt: new Date('2025-01-01T00:00:00.000Z')
            }
          }
        ]
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} ReportData entries for 2024`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAll2024PLData();