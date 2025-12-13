import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPLData() {
  console.log('📊 Verifying P&L Data Storage\n');
  
  // Check ImportedReport entries
  const importedReports = await prisma.importedReport.findMany({
    where: {
      type: 'PROFIT_LOSS',
      source: 'API'
    },
    orderBy: {
      periodStart: 'asc'
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      recordCount: true,
      importedBy: true,
      createdAt: true
    }
  });
  
  console.log(`Found ${importedReports.length} ImportedReport entries:\n`);
  importedReports.forEach(report => {
    const start = new Date(report.periodStart).toLocaleDateString();
    const end = new Date(report.periodEnd).toLocaleDateString();
    console.log(`  📅 ${start} - ${end}: ${report.status} (${report.recordCount} records)`);
  });
  
  // Check ReportData entries
  const reportData = await prisma.reportData.findMany({
    where: {
      reportType: 'PROFIT_LOSS'
    },
    orderBy: {
      periodStart: 'asc'
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      isActive: true,
      summary: true
    }
  });
  
  console.log(`\nFound ${reportData.length} ReportData entries:\n`);
  reportData.forEach(data => {
    const start = new Date(data.periodStart).toLocaleDateString();
    const end = new Date(data.periodEnd).toLocaleDateString();
    const summary = JSON.parse(data.summary as string);
    console.log(`  💰 ${start} - ${end}: Revenue $${summary.totalRevenue?.toFixed(2)}, Net Profit $${summary.netProfit?.toFixed(2)}`);
  });
  
  // Check for any duplicate or conflicting data
  const duplicates = reportData.filter((item, index, self) =>
    index !== self.findIndex((t) => 
      t.periodStart.getTime() === item.periodStart.getTime() && 
      t.periodEnd.getTime() === item.periodEnd.getTime()
    )
  );
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Warning: Found ${duplicates.length} duplicate entries`);
  } else {
    console.log('\n✅ No duplicate entries found');
  }
  
  // Summary
  console.log('\n📈 Summary:');
  console.log(`  - Total months with P&L data: ${reportData.length}`);
  console.log(`  - All imports successful: ${importedReports.every(r => r.status === 'COMPLETED') ? 'Yes' : 'No'}`);
  console.log(`  - Data covers: ${reportData.length > 0 ? `${new Date(reportData[0].periodStart).toLocaleDateString()} to ${new Date(reportData[reportData.length - 1].periodEnd).toLocaleDateString()}` : 'No data'}`);
}

// Run verification
verifyPLData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());