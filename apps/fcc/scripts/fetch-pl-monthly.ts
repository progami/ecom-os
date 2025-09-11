import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function deleteOldPLData() {
  console.log('🗑️  Deleting old P&L data...');
  
  // Delete old ReportData entries for P&L
  const deletedReportData = await prisma.reportData.deleteMany({
    where: {
      reportType: 'PROFIT_LOSS'
    }
  });
  
  // Delete old ImportedReport entries for P&L
  const deletedImportedReports = await prisma.importedReport.deleteMany({
    where: {
      type: 'PROFIT_LOSS'
    }
  });
  
  console.log(`✅ Deleted ${deletedReportData.count} ReportData entries`);
  console.log(`✅ Deleted ${deletedImportedReports.count} ImportedReport entries`);
}

async function fetchPLForMonth(year: number, month: number) {
  // Create date strings for the month
  const startDate = new Date(year, month - 1, 1); // First day of month
  const endDate = new Date(year, month, 0); // Last day of month
  
  const monthName = startDate.toLocaleString('default', { month: 'long' });
  console.log(`\n📊 Fetching P&L for ${monthName} ${year}...`);
  console.log(`   Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  try {
    // Format date as YYYY-MM-DD for the API
    const dateParam = endDate.toISOString().split('T')[0];
    
    const response = await fetch(`https://localhost:3003/api/v1/xero/reports/profit-loss?date=${dateParam}&timeframe=MONTH&periods=1&refresh=true`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y'
      },
      // @ts-ignore - Node fetch doesn't have rejectUnauthorized in types but it works
      agent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
    
    const data = await response.json();
    
    if (response.ok && !data.error) {
      console.log(`   ✅ Success! Revenue: $${data.totalRevenue?.toFixed(2) || 0}, Net Profit: $${data.netProfit?.toFixed(2) || 0}`);
      console.log(`   📝 ${data.metadata?.recordCount || 0} line items fetched`);
      return true;
    } else {
      console.error(`   ❌ Error: ${data.error || data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  try {
    // Delete old data first
    await deleteOldPLData();
    
    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    
    console.log(`\n🗓️  Fetching P&L data for ${currentYear} (January to ${now.toLocaleString('default', { month: 'long' })})`);
    
    // Fetch for each month of the current year up to current month
    let successCount = 0;
    let failCount = 0;
    
    for (let month = 1; month <= currentMonth; month++) {
      const success = await fetchPLForMonth(currentYear, month);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Add a small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n✅ Completed! Successfully fetched ${successCount} months, ${failCount} failed.`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();