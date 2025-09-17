import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import fs from 'fs/promises';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function fetchMonthData(year: number, month: number, cookie: string) {
  const endDate = new Date(year, month, 0); // Last day of month
  const dateStr = endDate.toISOString().split('T')[0];
  
  console.log(`📊 Fetching ${endDate.toLocaleString('default', { month: 'long' })} ${year}...`);
  
  try {
    const url = `https://localhost:3003/api/v1/xero/reports/profit-loss?date=${dateStr}&timeframe=MONTH&periods=1&refresh=true`;
    
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
      return null;
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`   ❌ API Error: ${data.error}`);
      return null;
    }
    
    console.log(`   ✅ Revenue: £${data.totalRevenue?.toFixed(2) || 0}, Net Profit: £${data.netProfit?.toFixed(2) || 0}`);
    return data;
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

async function aggregateYear2024() {
  const cookie = process.env.FCC_AUTH_COOKIE;

  if (!cookie) {
    throw new Error('FCC_AUTH_COOKIE is not set. Provide a valid central session cookie string (include NextAuth + Xero tokens).');
  }
  
  console.log('=== FETCHING YEAR 2024 P&L DATA ===\n');
  
  const monthlyData: any[] = [];
  const accountTotals: { [key: string]: { amount: number; section: string } } = {};
  
  let yearRevenue = 0;
  let yearCOGS = 0;
  let yearOpEx = 0;
  let yearOtherIncome = 0;
  let yearOtherExpenses = 0;
  
  // Fetch each month
  for (let month = 1; month <= 12; month++) {
    const data = await fetchMonthData(2024, month, cookie);
    
    if (data && data.detailedBreakdown) {
      monthlyData.push(data);
      
      // Aggregate totals
      yearRevenue += data.totalRevenue || 0;
      yearCOGS += data.costOfGoodsSold || 0;
      yearOpEx += data.operatingExpenses || 0;
      yearOtherIncome += data.otherIncome || 0;
      yearOtherExpenses += data.otherExpenses || 0;
      
      // Aggregate accounts
      const breakdown = data.detailedBreakdown;
      
      // Revenue accounts
      breakdown.revenue?.accounts?.forEach((acc: any) => {
        if (!accountTotals[acc.accountName]) {
          accountTotals[acc.accountName] = { amount: 0, section: 'Revenue' };
        }
        accountTotals[acc.accountName].amount += acc.amount;
      });
      
      // Other income
      breakdown.otherIncome?.accounts?.forEach((acc: any) => {
        if (!accountTotals[acc.accountName]) {
          accountTotals[acc.accountName] = { amount: 0, section: 'Other Income' };
        }
        accountTotals[acc.accountName].amount += acc.amount;
      });
      
      // COGS
      breakdown.costOfGoodsSold?.accounts?.forEach((acc: any) => {
        if (!accountTotals[acc.accountName]) {
          accountTotals[acc.accountName] = { amount: 0, section: 'Cost of Sales' };
        }
        accountTotals[acc.accountName].amount += acc.amount;
      });
      
      // Operating expenses
      breakdown.operatingExpenses?.accounts?.forEach((acc: any) => {
        if (!accountTotals[acc.accountName]) {
          accountTotals[acc.accountName] = { amount: 0, section: 'Operating Expenses' };
        }
        accountTotals[acc.accountName].amount += acc.amount;
      });
      
      // Other expenses
      breakdown.otherExpenses?.accounts?.forEach((acc: any) => {
        if (!accountTotals[acc.accountName]) {
          accountTotals[acc.accountName] = { amount: 0, section: 'Other Expenses' };
        }
        accountTotals[acc.accountName].amount += acc.amount;
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  const yearGrossProfit = yearRevenue - yearCOGS;
  const yearNetProfit = yearRevenue + yearOtherIncome - yearCOGS - yearOpEx - yearOtherExpenses;
  
  console.log('\n=== YEAR 2024 TOTALS ===');
  console.log(`Total Revenue: £${yearRevenue.toFixed(2)}`);
  console.log(`Cost of Goods Sold: £${yearCOGS.toFixed(2)}`);
  console.log(`Gross Profit: £${yearGrossProfit.toFixed(2)}`);
  console.log(`Operating Expenses: £${yearOpEx.toFixed(2)}`);
  console.log(`Other Income: £${yearOtherIncome.toFixed(2)}`);
  console.log(`Other Expenses: £${yearOtherExpenses.toFixed(2)}`);
  console.log(`Net Profit: £${yearNetProfit.toFixed(2)}`);
  console.log(`\nMonths with data: ${monthlyData.length}`);
  
  // Save aggregated data
  const aggregatedData = {
    period: 'Year 2024',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    totalRevenue: yearRevenue,
    totalExpenses: yearCOGS + yearOpEx + yearOtherExpenses,
    costOfGoodsSold: yearCOGS,
    operatingExpenses: yearOpEx,
    otherIncome: yearOtherIncome,
    otherExpenses: yearOtherExpenses,
    grossProfit: yearGrossProfit,
    netProfit: yearNetProfit,
    accounts: accountTotals,
    monthlyData: monthlyData.length,
    fetchedAt: new Date().toISOString()
  };
  
  await fs.writeFile(
    '/tmp/year-2024-aggregated.json', 
    JSON.stringify(aggregatedData, null, 2)
  );
  
  console.log('\nData saved to /tmp/year-2024-aggregated.json');
  
  // Compare with Excel
  console.log('\n=== COMPARING WITH EXCEL ===');
  const excelData = JSON.parse(await fs.readFile('data/2024-pl-excel-data.json', 'utf-8'));
  
  let matches = 0;
  let differences = 0;
  
  // Compare each Excel account
  excelData.line_items.forEach((item: any) => {
    const excelAmount = item.amount;
    const apiAmount = accountTotals[item.account]?.amount || 0;
    
    if (Math.abs(excelAmount - apiAmount) < 0.01) {
      matches++;
      console.log(`✅ ${item.account}: £${excelAmount.toFixed(2)}`);
    } else {
      differences++;
      console.log(`❌ ${item.account}:`);
      console.log(`   Excel: £${excelAmount.toFixed(2)}`);
      console.log(`   API:   £${apiAmount.toFixed(2)}`);
      console.log(`   Diff:  £${(apiAmount - excelAmount).toFixed(2)}`);
    }
  });
  
  console.log(`\n✅ Matching: ${matches}`);
  console.log(`❌ Different: ${differences}`);
  
  return aggregatedData;
}

// Run the aggregation
aggregateYear2024()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
