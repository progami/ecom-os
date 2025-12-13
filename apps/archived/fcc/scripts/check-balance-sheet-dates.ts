import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBalanceSheetDates() {
  console.log('=== BALANCE SHEET DATE ANALYSIS ===\n');

  try {
    // Get all Balance Sheet records
    const balanceSheets = await prisma.reportData.findMany({
      where: { 
        reportType: 'BALANCE_SHEET'
      },
      select: {
        periodStart: true,
        periodEnd: true,
        version: true,
        isActive: true,
        createdAt: true,
        data: true
      },
      orderBy: [
        { periodEnd: 'asc' },
        { version: 'desc' }
      ]
    });

    console.log(`Total Balance Sheet records: ${balanceSheets.length}\n`);

    // Group by period
    const periodMap = new Map<string, any[]>();
    
    balanceSheets.forEach(bs => {
      const key = `${bs.periodStart.toISOString().split('T')[0]} to ${bs.periodEnd.toISOString().split('T')[0]}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, []);
      }
      periodMap.get(key)!.push(bs);
    });

    console.log('Balance Sheet periods found:\n');
    
    for (const [period, records] of periodMap.entries()) {
      console.log(`📅 ${period}`);
      records.forEach(r => {
        const data = r.data as any;
        const hasData = data && data.sections && data.sections.length > 0;
        console.log(`   Version ${r.version}: Active=${r.isActive}, HasData=${hasData}, Created=${r.createdAt.toISOString().split('T')[0]}`);
      });
      console.log('');
    }

    // Check pattern
    console.log('\n🔍 PATTERN ANALYSIS:\n');
    
    const periods = Array.from(periodMap.keys()).sort();
    console.log('Periods in chronological order:');
    periods.forEach(p => console.log(`  - ${p}`));

    // Analyze the pattern
    console.log('\n📊 OBSERVATIONS:\n');
    
    // Check if we only have specific months
    const endDates = balanceSheets.map(bs => bs.periodEnd).sort();
    const uniqueEndDates = [...new Set(endDates.map(d => d.toISOString().split('T')[0]))];
    
    console.log('Unique end dates:');
    uniqueEndDates.forEach(d => console.log(`  - ${d}`));

    // Check imported reports for Balance Sheet
    console.log('\n\n📥 IMPORTED BALANCE SHEET FILES:\n');
    
    const importedBS = await prisma.importedReport.findMany({
      where: { 
        type: 'BALANCE_SHEET',
        status: 'COMPLETED'
      },
      select: {
        fileName: true,
        importedAt: true
      },
      orderBy: { importedAt: 'desc' }
    });

    if (importedBS.length > 0) {
      console.log(`Found ${importedBS.length} imported Balance Sheet files:`);
      importedBS.forEach(imp => {
        console.log(`  - ${imp.fileName} (imported: ${imp.importedAt.toISOString()})`);
      });
    } else {
      console.log('No imported Balance Sheet files found.');
    }

    // Check for any test scripts that might have fetched these specific dates
    console.log('\n\n🧪 POTENTIAL TEST SCRIPT PATTERNS:\n');
    
    if (uniqueEndDates.includes('2024-06-30') && uniqueEndDates.includes('2024-10-31')) {
      console.log('The dates June 30 and October 31 suggest:');
      console.log('  - June 30: End of Q2 2024 (half-year report)');
      console.log('  - October 31: End of month report');
      console.log('\nThese might be:');
      console.log('  1. Manually imported Excel files for these specific periods');
      console.log('  2. Test data from specific test scripts');
      console.log('  3. Actual Xero API fetches for these periods only');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBalanceSheetDates();