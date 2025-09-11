import fetch from 'node-fetch';
import fs from 'fs';

async function fetch2024PLFromAPI() {
  console.log('📊 Fetching P&L for year ending 31 December 2024 from API...\n');
  
  try {
    // Fetch P&L for Dec 31, 2024 with 12 month period
    const response = await fetch(`https://localhost:3003/api/v1/xero/reports/profit-loss?date=2024-12-31&timeframe=YEAR&periods=1&refresh=true`, {
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
      console.log('✅ API Response received successfully');
      console.log(`   Total Revenue: £${data.totalRevenue?.toFixed(2) || 0}`);
      console.log(`   Total Expenses: £${data.totalExpenses?.toFixed(2) || 0}`);
      console.log(`   Net Profit: £${data.netProfit?.toFixed(2) || 0}`);
      console.log(`   Record Count: ${data.metadata?.recordCount || 0}\n`);
      
      // Extract line items from detailed breakdown
      const lineItems = [];
      
      // Revenue accounts
      if (data.detailedBreakdown?.revenue?.accounts) {
        data.detailedBreakdown.revenue.accounts.forEach((acc: any) => {
          lineItems.push({
            section: 'Revenue/Turnover',
            account: acc.accountName,
            amount: acc.amount,
            accountId: acc.accountId
          });
        });
      }
      
      // Other Income accounts
      if (data.detailedBreakdown?.otherIncome?.accounts) {
        data.detailedBreakdown.otherIncome.accounts.forEach((acc: any) => {
          lineItems.push({
            section: 'Other Income',
            account: acc.accountName,
            amount: acc.amount,
            accountId: acc.accountId
          });
        });
      }
      
      // Cost of Goods Sold accounts
      if (data.detailedBreakdown?.costOfGoodsSold?.accounts) {
        data.detailedBreakdown.costOfGoodsSold.accounts.forEach((acc: any) => {
          lineItems.push({
            section: 'Cost of Sales',
            account: acc.accountName,
            amount: acc.amount,
            accountId: acc.accountId
          });
        });
      }
      
      // Operating Expenses accounts
      if (data.detailedBreakdown?.operatingExpenses?.accounts) {
        data.detailedBreakdown.operatingExpenses.accounts.forEach((acc: any) => {
          lineItems.push({
            section: 'Operating Expenses',
            account: acc.accountName,
            amount: acc.amount,
            accountId: acc.accountId
          });
        });
      }
      
      // Other Expenses accounts
      if (data.detailedBreakdown?.otherExpenses?.accounts) {
        data.detailedBreakdown.otherExpenses.accounts.forEach((acc: any) => {
          lineItems.push({
            section: 'Other Expenses',
            account: acc.accountName,
            amount: acc.amount,
            accountId: acc.accountId
          });
        });
      }
      
      // Save API data
      const apiData = {
        period: 'Year ending 31 December 2024',
        totalRevenue: data.totalRevenue,
        totalExpenses: data.totalExpenses,
        netProfit: data.netProfit,
        grossProfit: data.grossProfit,
        line_items: lineItems,
        metadata: data.metadata,
        raw_response: data
      };
      
      fs.writeFileSync('data/2024-pl-api-data.json', JSON.stringify(apiData, null, 2));
      console.log('Data saved to data/2024-pl-api-data.json');
      
      // Print line items summary
      console.log('\n=== Line Items Summary ===');
      const sections = lineItems.reduce((acc: any, item: any) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
      }, {});
      
      Object.entries(sections).forEach(([section, items]: [string, any]) => {
        console.log(`\n${section} (${items.length} items):`);
        items.forEach((item: any) => {
          console.log(`  ${item.account}: £${item.amount.toFixed(2)}`);
        });
      });
      
      return true;
    } else {
      console.error('❌ Error:', data.error || data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to fetch:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Run the fetch
fetch2024PLFromAPI();