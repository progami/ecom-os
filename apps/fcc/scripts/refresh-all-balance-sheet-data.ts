import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();
const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE';
const cookie = process.env[AUTH_COOKIE_ENV];

if (!cookie) {
  throw new Error(
    `Missing authentication cookie. Set ${AUTH_COOKIE_ENV} with a valid central session cookie string (include NextAuth + Xero tokens).`
  );
}

const agent = new https.Agent({
  rejectUnauthorized: false
});


async function deleteAllData() {
  console.log('🗑️  STEP 1: DELETING ALL EXISTING BALANCE SHEET DATA\n');
  
  try {
    const deletedReportData = await prisma.reportData.deleteMany({
      where: { reportType: 'BALANCE_SHEET' }
    });
    console.log(`✅ Deleted ${deletedReportData.count} entries from ReportData`);
    
    const deletedImports = await prisma.importedReport.deleteMany({
      where: { type: 'BALANCE_SHEET' }
    });
    console.log(`✅ Deleted ${deletedImports.count} entries from ImportedReport`);
    
    console.log('\n✅ All old Balance Sheet data cleared!\n');
    
    structuredLogger.info('[Balance Sheet Refresh] Deleted all existing data', {
      reportDataDeleted: deletedReportData.count,
      importedReportDeleted: deletedImports.count
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting data:', error);
    return false;
  }
}

async function fetchBalanceSheetData(date: string, description: string) {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${date}&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      // @ts-ignore
      agent
    });
    
    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse response`);
      return { success: false, error: 'Invalid JSON response' };
    }
    
    if (!response.ok || responseData.error) {
      console.error(`   ❌ Error: ${responseData.error || `HTTP ${response.status}`}`);
      return { success: false, error: responseData.error || `HTTP ${response.status}` };
    }
    
    console.log(`   ✅ Assets: £${responseData.totalAssets?.toFixed(2) || 0}, Net: £${responseData.netAssets?.toFixed(2) || 0}`);
    return { success: true, data: responseData };
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function fetchAllHistoricalData() {
  console.log('📊 STEP 2: FETCHING FRESH BALANCE SHEET DATA\n');
  console.log('This will fetch monthly Balance Sheets from January 2021 to present.\n');
  
  const startYear = 2021;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  
  // Fetch monthly data only (to avoid duplicates)
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} ---`);
    
    const maxMonth = (year === currentYear) ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      const result = await fetchBalanceSheetData(dateStr, `${monthName} ${year}`);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Summary
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
  
  structuredLogger.info('[Balance Sheet Refresh] Completed fresh data fetch', {
    successCount,
    failureCount,
    totalAttempts: successCount + failureCount,
    dateRange: `${startYear}-01 to ${currentYear}-${currentMonth.toString().padStart(2, '0')}`
  });
}

async function main() {
  console.log('=== BALANCE SHEET DATA REFRESH ===\n');
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  try {
    // Step 1: Delete all old data
    const deleteSuccess = await deleteAllData();
    
    if (!deleteSuccess) {
      console.error('❌ Failed to delete old data. Aborting refresh.');
      return;
    }
    
    // Wait a moment before starting fetches
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Fetch all fresh data
    await fetchAllHistoricalData();
    
    console.log(`\n✅ Balance Sheet refresh completed at: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    structuredLogger.error('[Balance Sheet Refresh] Fatal error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the complete refresh
main();
