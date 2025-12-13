#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🗄️ Checking database for report data...');
    
    // Check all ReportData entries
    const reportData = await prisma.reportData.findMany({
      select: {
        id: true,
        reportType: true,
        periodStart: true,
        periodEnd: true,
        isActive: true,
        version: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('\n📊 ReportData entries:');
    console.log('======================');
    if (reportData.length === 0) {
      console.log('No report data found');
    } else {
      reportData.forEach(report => {
        console.log(`${report.reportType}: ${report.periodStart.toISOString().split('T')[0]} to ${report.periodEnd.toISOString().split('T')[0]} (v${report.version}, active: ${report.isActive})`);
      });
    }
    
    // Check ImportedReport entries
    const importedReports = await prisma.importedReport.findMany({
      select: {
        id: true,
        type: true,
        status: true,
        recordCount: true,
        fileName: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('\n📥 ImportedReport entries:');
    console.log('==========================');
    if (importedReports.length === 0) {
      console.log('No imported reports found');
    } else {
      importedReports.forEach(report => {
        console.log(`${report.type}: ${report.fileName} (${report.status}, ${report.recordCount} records)`);
      });
    }
    
    // Test specific queries
    console.log('\n🔍 Testing specific queries:');
    console.log('=============================');
    
    // Test bank summary query that's failing
    const bankSummaryQuery = {
      reportType: 'BANK_SUMMARY',
      isActive: true
    };
    
    const bankSummaryData = await prisma.reportData.findFirst({
      where: bankSummaryQuery,
      orderBy: { version: 'desc' }
    });
    
    console.log('Bank Summary query result:', bankSummaryData ? 'Found' : 'Not found');
    if (bankSummaryData) {
      console.log(`  Period: ${bankSummaryData.periodStart.toISOString().split('T')[0]} to ${bankSummaryData.periodEnd.toISOString().split('T')[0]}`);
    }
    
    // Test aged receivables query
    const agedReceivablesData = await prisma.reportData.findFirst({
      where: {
        reportType: 'AGED_RECEIVABLES',
        isActive: true
      },
      orderBy: { version: 'desc' }
    });
    
    console.log('Aged Receivables query result:', agedReceivablesData ? 'Found' : 'Not found');
    if (agedReceivablesData) {
      console.log(`  Period: ${agedReceivablesData.periodStart.toISOString().split('T')[0]} to ${agedReceivablesData.periodEnd.toISOString().split('T')[0]}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});