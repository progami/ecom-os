const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyBalanceSheetImports() {
  try {
    console.log('Verifying Balance Sheet Imports...\n');

    // 1. Check imported reports
    const importedReports = await prisma.importedReport.findMany({
      where: { type: 'BALANCE_SHEET' },
      orderBy: { importedAt: 'desc' },
      take: 10
    });

    console.log(`Found ${importedReports.length} balance sheet imports:\n`);

    importedReports.forEach((report, index) => {
      console.log(`${index + 1}. ${report.fileName || 'Unknown file'}`);
      console.log(`   ID: ${report.id}`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Period: ${new Date(report.periodStart).toLocaleDateString()} - ${new Date(report.periodEnd).toLocaleDateString()}`);
      console.log(`   Records: ${report.recordCount || 0}`);
      console.log(`   Imported: ${new Date(report.importedAt).toLocaleString()}`);
      console.log(`   By: ${report.importedBy}\n`);
    });

    // 2. Check report data
    const reportData = await prisma.reportData.findMany({
      where: { 
        reportType: 'BALANCE_SHEET',
        isActive: true 
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\nFound ${reportData.length} active balance sheet data records:\n`);

    for (const data of reportData) {
      console.log(`Report Data ID: ${data.id}`);
      console.log(`Period: ${new Date(data.periodStart).toLocaleDateString()} - ${new Date(data.periodEnd).toLocaleDateString()}`);
      console.log(`Import ID: ${data.importedReportId || 'N/A'}`);
      
      // Parse and display key metrics
      try {
        const parsedData = JSON.parse(data.data);
        console.log(`Total Assets: ${parsedData.totalAssets?.toLocaleString() || 'N/A'}`);
        console.log(`Total Liabilities: ${parsedData.totalLiabilities?.toLocaleString() || 'N/A'}`);
        console.log(`Net Assets: ${parsedData.netAssets?.toLocaleString() || 'N/A'}`);
      } catch (e) {
        console.log('Could not parse data');
      }
      console.log('---\n');
    }

    // 3. Recommendations
    console.log('\nRecommendations:');
    if (importedReports.length === 0) {
      console.log('- No balance sheet imports found. Import files using the UI at /reports/import');
    } else {
      console.log('- Balance sheet imports are available');
      console.log('- Visit /reports/detailed-reports/balance-sheet to view the data');
      console.log('- Click "View Imports" to see the unified history');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBalanceSheetImports();