import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

async function analyzeBalanceSheetCreation() {
  console.log('=== ANALYZING BALANCE SHEET DATA CREATION ===\n');

  try {
    // Get the specific records we're interested in
    const targetRecords = await prisma.reportData.findMany({
      where: {
        reportType: 'BALANCE_SHEET',
        OR: [
          {
            periodStart: new Date('2024-01-01'),
            periodEnd: new Date('2024-06-30')
          },
          {
            periodStart: new Date('2024-01-01'), 
            periodEnd: new Date('2024-10-31')
          }
        ]
      },
      include: {
        importedReport: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${targetRecords.length} matching Balance Sheet records:\n`);

    for (const record of targetRecords) {
      const periodStr = `${record.periodStart.toISOString().split('T')[0]} to ${record.periodEnd.toISOString().split('T')[0]}`;
      console.log(`📊 ${periodStr}:`);
      console.log(`   - Created: ${record.createdAt.toISOString()}`);
      console.log(`   - Version: ${record.version}`);
      console.log(`   - Active: ${record.isActive}`);
      
      if (record.importedReport) {
        console.log(`   - Source: Imported from ${record.importedReport.source}`);
        console.log(`   - Import Date: ${record.importedReport.importedAt.toISOString()}`);
        console.log(`   - File: ${record.importedReport.fileName || 'N/A'}`);
      } else {
        console.log(`   - Source: Direct API creation (no import record)`);
      }
      
      // Check the data
      const data = record.data as any;
      if (data) {
        console.log(`   - Has Data: Yes`);
        console.log(`   - Total Assets: ${data.totalAssets || 'N/A'}`);
        console.log(`   - Total Liabilities: ${data.totalLiabilities || 'N/A'}`);
      }
      console.log('');
    }

    // Check if these were created by test scripts
    console.log('\n🔍 LIKELY CREATION SCENARIOS:\n');
    
    if (targetRecords.length === 2) {
      const junRecord = targetRecords.find(r => r.periodEnd.getMonth() === 5); // June is month 5
      const octRecord = targetRecords.find(r => r.periodEnd.getMonth() === 9); // October is month 9
      
      if (junRecord && octRecord) {
        console.log('Both June 30 and October 31 records exist.\n');
        
        // Check creation pattern
        const timeDiff = Math.abs(junRecord.createdAt.getTime() - octRecord.createdAt.getTime());
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 1) {
          console.log('✓ Records were created within 1 hour of each other');
          console.log('  → Likely created by the same test script or import process');
        } else {
          console.log('✓ Records were created at different times');
          console.log(`  → Time difference: ${Math.round(hoursDiff)} hours`);
        }
        
        // Check if from imports
        const bothImported = junRecord.importedReport && octRecord.importedReport;
        const neitherImported = !junRecord.importedReport && !octRecord.importedReport;
        
        if (bothImported) {
          console.log('\n✓ Both records have import references');
          console.log('  → Data was imported from files or external source');
        } else if (neitherImported) {
          console.log('\n✓ Neither record has import references');
          console.log('  → Data was created directly via API, possibly from test scripts');
          console.log('  → Check test-all-report-endpoints.ts which tests with October 31, 2024');
        }
      }
    }
    
    // Pattern analysis
    console.log('\n\n💡 PATTERN ANALYSIS:\n');
    console.log('The dates suggest:');
    console.log('- June 30, 2024: End of Q2/H1 (half-year report)');
    console.log('- October 31, 2024: End of October (10-month report)');
    console.log('\nThese are common reporting periods for:');
    console.log('1. Quarterly/semi-annual financial reviews');
    console.log('2. Pre-year-end financial analysis');
    console.log('3. Test data covering different time periods');

    // Check logs
    console.log('\n\n📝 RECOMMENDATION:\n');
    console.log('To find the exact source:');
    console.log('1. Check git history: git log --grep="balance sheet" --since="2024-01-01"');
    console.log('2. Check development.log for API calls around the creation times');
    console.log('3. The test-all-report-endpoints.ts script uses October 31, 2024 as TEST_DATE');
    console.log('4. June 30 might be from a similar test or manual import');

  } catch (error) {
    console.error('❌ Error:', error);
    structuredLogger.error('[Balance Sheet Analysis] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeBalanceSheetCreation();