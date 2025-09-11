import { prisma } from '../lib/prisma';

async function checkImportedReports() {
  try {
    console.log('Checking ImportedReport entries...\n');
    
    // Get recent BALANCE_SHEET imports
    const reports = await prisma.importedReport.findMany({
      where: {
        type: 'BALANCE_SHEET'
      },
      orderBy: {
        importedAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        source: true,
        status: true,
        importedAt: true,
        importedBy: true,
        recordCount: true
      }
    });
    
    console.log(`Found ${reports.length} Balance Sheet imports:\n`);
    
    reports.forEach((report, index) => {
      console.log(`${index + 1}. ${report.importedAt.toLocaleString()}`);
      console.log(`   ID: ${report.id}`);
      console.log(`   Source: ${report.source}`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Records: ${report.recordCount}`);
      console.log(`   By: ${report.importedBy}`);
      console.log('');
    });
    
    // Check for API imports specifically
    const apiImports = reports.filter(r => r.source === 'API');
    console.log(`\nAPI imports: ${apiImports.length}`);
    
    if (apiImports.length > 0) {
      console.log('Most recent API import:', apiImports[0].importedAt.toLocaleString());
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportedReports();