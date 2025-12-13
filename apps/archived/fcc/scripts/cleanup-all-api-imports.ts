import { prisma } from '../lib/prisma';

async function cleanupAllAPIImports() {
  try {
    console.log('Cleaning up all API import entries...\n');
    
    // Delete all API imports for BALANCE_SHEET
    const result = await prisma.importedReport.deleteMany({
      where: {
        AND: [
          { type: 'BALANCE_SHEET' },
          { source: 'API' }
        ]
      }
    });
    
    console.log(`Deleted ${result.count} API import entries`);
    
    // Show remaining imports
    const remaining = await prisma.importedReport.findMany({
      where: {
        type: 'BALANCE_SHEET'
      },
      select: {
        id: true,
        source: true,
        importedBy: true,
        importedAt: true
      },
      orderBy: {
        importedAt: 'desc'
      }
    });
    
    console.log(`\nRemaining imports: ${remaining.length}`);
    remaining.forEach(imp => {
      console.log(`- ${imp.source} by ${imp.importedBy} at ${imp.importedAt.toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllAPIImports();