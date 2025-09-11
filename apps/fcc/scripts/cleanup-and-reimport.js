const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Cleaning up existing balance sheet imports...\n');
  
  try {
    // Delete all balance sheet imports
    const deletedReports = await prisma.reportData.deleteMany({
      where: { reportType: 'BALANCE_SHEET' }
    });
    console.log(`Deleted ${deletedReports.count} report data records`);
    
    const deletedImports = await prisma.importedReport.deleteMany({
      where: { type: 'BALANCE_SHEET' }
    });
    console.log(`Deleted ${deletedImports.count} import records`);
    
    console.log('\n✓ Cleanup complete');
    console.log('\nNow run: node scripts/simple-balance-sheet-import.js');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();