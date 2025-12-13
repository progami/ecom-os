import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';

const prisma = new PrismaClient();

async function fetchMonthPL(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const monthName = startDate.toLocaleString('default', { month: 'long' });
  
  console.log(`📊 Fetching P&L for ${monthName} ${year}...`);
  
  try {
    const dateParam = endDate.toISOString().split('T')[0];
    const response = await fetch(`https://localhost:3003/api/v1/xero/reports/profit-loss?date=${dateParam}&timeframe=MONTH&periods=1&refresh=true`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y'
      },
      // @ts-ignore
      agent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
    
    const data = await response.json();
    
    if (response.ok && !data.error) {
      console.log(`   ✅ Revenue: $${data.totalRevenue?.toFixed(2) || 0}, Net: $${data.netProfit?.toFixed(2) || 0}`);
      return { success: true, data };
    } else {
      console.error(`   ❌ Error: ${data.error || data.message}`);
      return { success: false, error: data.error || data.message };
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error };
  }
}

async function aggregateYearData() {
  console.log('📊 Fetching 2024 P&L data month by month...\n');
  
  const monthlyData = [];
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalCOGS = 0;
  let totalOperatingExpenses = 0;
  let totalOtherIncome = 0;
  
  const allAccounts: { [key: string]: { section: string; total: number } } = {};
  
  // Fetch each month
  for (let month = 1; month <= 12; month++) {
    const result = await fetchMonthPL(2024, month);
    if (result.success && result.data) {
      monthlyData.push(result.data);
      
      // Aggregate totals
      totalRevenue += result.data.totalRevenue || 0;
      totalExpenses += result.data.totalExpenses || 0;
      totalCOGS += result.data.costOfGoodsSold || 0;
      totalOperatingExpenses += result.data.operatingExpenses || 0;
      totalOtherIncome += result.data.otherIncome || 0;
      
      // Aggregate line items
      const breakdown = result.data.detailedBreakdown;
      if (breakdown) {
        // Revenue accounts
        breakdown.revenue?.accounts?.forEach((acc: any) => {
          const key = acc.accountName;
          if (!allAccounts[key]) allAccounts[key] = { section: 'Revenue', total: 0 };
          allAccounts[key].total += acc.amount;
        });
        
        // Other income
        breakdown.otherIncome?.accounts?.forEach((acc: any) => {
          const key = acc.accountName;
          if (!allAccounts[key]) allAccounts[key] = { section: 'Other Income', total: 0 };
          allAccounts[key].total += acc.amount;
        });
        
        // COGS
        breakdown.costOfGoodsSold?.accounts?.forEach((acc: any) => {
          const key = acc.accountName;
          if (!allAccounts[key]) allAccounts[key] = { section: 'Cost of Sales', total: 0 };
          allAccounts[key].total += acc.amount;
        });
        
        // Operating expenses
        breakdown.operatingExpenses?.accounts?.forEach((acc: any) => {
          const key = acc.accountName;
          if (!allAccounts[key]) allAccounts[key] = { section: 'Operating Expenses', total: 0 };
          allAccounts[key].total += acc.amount;
        });
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const netProfit = totalRevenue - totalExpenses;
  const grossProfit = totalRevenue - totalCOGS;
  
  console.log('\n=== 2024 YEAR-END TOTALS (from API) ===');
  console.log(`Total Revenue: £${totalRevenue.toFixed(2)}`);
  console.log(`Total Expenses: £${totalExpenses.toFixed(2)}`);
  console.log(`Gross Profit: £${grossProfit.toFixed(2)}`);
  console.log(`Net Profit: £${netProfit.toFixed(2)}`);
  console.log(`Cost of Goods Sold: £${totalCOGS.toFixed(2)}`);
  console.log(`Operating Expenses: £${totalOperatingExpenses.toFixed(2)}`);
  console.log(`Other Income: £${totalOtherIncome.toFixed(2)}`);
  
  // Compare with Excel
  console.log('\n=== COMPARISON WITH EXCEL ===');
  const excelData = JSON.parse(fs.readFileSync('data/2024-pl-excel-data.json', 'utf-8'));
  
  console.log('\nLine-by-line comparison:');
  const excelMap = new Map();
  excelData.line_items.forEach((item: any) => {
    excelMap.set(item.account, item.amount);
  });
  
  let matches = 0;
  let differences = 0;
  
  Object.entries(allAccounts).forEach(([account, data]) => {
    const apiAmount = data.total;
    const excelAmount = excelMap.get(account);
    
    if (excelAmount !== undefined) {
      const diff = Math.abs(apiAmount - excelAmount);
      if (diff < 0.01) {
        matches++;
        console.log(`✅ ${account}: Excel £${excelAmount.toFixed(2)} = API £${apiAmount.toFixed(2)}`);
      } else {
        differences++;
        console.log(`❌ ${account}: Excel £${excelAmount.toFixed(2)} ≠ API £${apiAmount.toFixed(2)}`);
      }
      excelMap.delete(account);
    } else {
      console.log(`⚠️  ${account}: Only in API (£${apiAmount.toFixed(2)})`);
    }
  });
  
  // Check remaining Excel items
  excelMap.forEach((amount, account) => {
    if (!account.includes('Total') && !account.includes('Profit')) {
      console.log(`⚠️  ${account}: Only in Excel (£${amount.toFixed(2)})`);
    }
  });
  
  console.log(`\n✅ Matching: ${matches}`);
  console.log(`❌ Different: ${differences}`);
  
  // Save aggregated data
  const aggregatedData = {
    period: 'Year 2024 (aggregated from monthly data)',
    totalRevenue,
    totalExpenses,
    netProfit,
    grossProfit,
    costOfGoodsSold: totalCOGS,
    operatingExpenses: totalOperatingExpenses,
    otherIncome: totalOtherIncome,
    accounts: allAccounts,
    monthlyData: monthlyData.length
  };
  
  fs.writeFileSync('data/2024-pl-api-aggregated.json', JSON.stringify(aggregatedData, null, 2));
  console.log('\nData saved to data/2024-pl-api-aggregated.json');
}

// Run the aggregation
aggregateYearData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());