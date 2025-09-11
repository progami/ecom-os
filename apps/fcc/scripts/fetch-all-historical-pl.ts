import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const cookie = 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y';

async function fetchPLData(date: string, timeframe: 'MONTH' | 'YEAR', description: string) {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/profit-loss?date=${date}&timeframe=${timeframe}&periods=1&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      // @ts-ignore
      agent
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ HTTP ${response.status}: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`   ❌ API Error: ${data.error}`);
      return { success: false, error: data.error };
    }
    
    console.log(`   ✅ Revenue: £${data.totalRevenue?.toFixed(2) || 0}, Net Profit: £${data.netProfit?.toFixed(2) || 0}`);
    return { success: true, data };
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function clearExistingData(startDate: Date, endDate: Date) {
  try {
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: startDate,
        periodEnd: endDate
      }
    });
    
    if (deleted.count > 0) {
      console.log(`   🧹 Cleared ${deleted.count} existing entries`);
    }
  } catch (error) {
    console.error(`   ⚠️  Error clearing data: ${error}`);
  }
}

async function fetchAllHistoricalData() {
  console.log('=== FETCHING ALL HISTORICAL P&L DATA ===\n');
  console.log('This will fetch monthly and yearly data from January 2021 to present.\n');
  
  const startYear = 2021;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  
  // 1. Fetch all monthly data
  console.log('📅 FETCHING MONTHLY DATA\n');
  
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} ---`);
    
    const maxMonth = (year === currentYear) ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      // Clear existing data for this period
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      await clearExistingData(startDate, endDate);
      
      const result = await fetchPLData(dateStr, 'MONTH', `${monthName} ${year}`);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // 2. Fetch yearly data
  console.log('\n\n📊 FETCHING YEARLY DATA\n');
  
  for (let year = startYear; year <= currentYear; year++) {
    const dateStr = `${year}-12-31`;
    
    // Clear existing data for this year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    await clearExistingData(startDate, endDate);
    
    const result = await fetchPLData(dateStr, 'YEAR', `Year ${year}`);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
  
  // Log to development.log
  structuredLogger.info('[Historical P&L Fetch] Completed', {
    successCount,
    failureCount,
    totalAttempts: successCount + failureCount,
    dateRange: `${startYear}-01 to ${currentYear}-${currentMonth.toString().padStart(2, '0')}`
  });
}

// Run the historical data fetch
fetchAllHistoricalData()
  .catch(error => {
    console.error('Fatal error:', error);
    structuredLogger.error('[Historical P&L Fetch] Fatal error', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });