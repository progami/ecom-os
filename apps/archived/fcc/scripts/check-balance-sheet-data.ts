import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBalanceSheetData() {
  console.log('=== CURRENT BALANCE SHEET DATA ===\n');
  
  try {
    // Get all Balance Sheet data
    const balanceSheets = await prisma.reportData.findMany({
      where: {
        reportType: 'BALANCE_SHEET'
      },
      orderBy: {
        periodEnd: 'desc'
      },
      take: 20
    });
    
    console.log(`Total Balance Sheet records: ${balanceSheets.length}\n`);
    
    console.log('Recent Balance Sheet entries:');
    console.log('Period Start -> Period End | Version | Active | Created');
    console.log('-'.repeat(60));
    
    balanceSheets.forEach(bs => {
      const startStr = bs.periodStart.toISOString().split('T')[0];
      const endStr = bs.periodEnd.toISOString().split('T')[0];
      const createdStr = bs.createdAt.toISOString().split('T')[0];
      console.log(`${startStr} -> ${endStr} | v${bs.version} | ${bs.isActive ? '✓' : '✗'} | ${createdStr}`);
    });
    
    // Check for failed imports
    console.log('\n\n=== FAILED BALANCE SHEET IMPORTS ===\n');
    
    const failedImports = await prisma.importedReport.findMany({
      where: {
        type: 'BALANCE_SHEET',
        status: 'FAILED'
      },
      orderBy: {
        importedAt: 'desc'
      },
      take: 10
    });
    
    console.log(`Total failed imports: ${failedImports.length}\n`);
    
    if (failedImports.length > 0) {
      console.log('Recent failures:');
      failedImports.forEach(fi => {
        console.log(`\n${fi.periodEnd.toISOString().split('T')[0]}:`);
        console.log(`  Error: ${fi.errorLog}`);
        if (fi.rawData) {
          try {
            const rawData = JSON.parse(fi.rawData);
            console.log(`  Details: ${JSON.stringify(rawData.error?.message || rawData.error || 'No details', null, 2)}`);
          } catch (e) {
            console.log(`  Raw Data: ${fi.rawData.substring(0, 200)}...`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkBalanceSheetData();