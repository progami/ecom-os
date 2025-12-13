import fetch from 'node-fetch';
import fs from 'fs';

async function fetch2024PLFromAPI() {
  console.log('📊 Fetching P&L for year 2024 (Jan 1 - Dec 31) from API...\n');
  
  try {
    // Fetch P&L for full year 2024 using 12 monthly periods
    // We need to use a different approach since Xero limits to 365 days
    const url = `https://localhost:3003/api/v1/xero/reports/profit-loss?date=2024-12-31&timeframe=MONTH&periods=12&refresh=true`;
    
    console.log(`Fetching from: ${url}\n`);
    
    const response = await fetch(url, {
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
      console.log(`   Gross Profit: £${data.grossProfit?.toFixed(2) || 0}`);
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
        period: 'Year 2024 (Jan 1 - Dec 31)',
        totalRevenue: data.totalRevenue,
        totalExpenses: data.totalExpenses,
        netProfit: data.netProfit,
        grossProfit: data.grossProfit,
        costOfGoodsSold: data.costOfGoodsSold,
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
        const total = items.reduce((sum: number, item: any) => sum + item.amount, 0);
        console.log(`  Total: £${total.toFixed(2)}`);
      });
      
      // Compare with Excel
      console.log('\n\n=== COMPARISON WITH EXCEL ===');
      
      // Read Excel data
      const excelData = JSON.parse(fs.readFileSync('data/2024-pl-excel-data.json', 'utf-8'));
      
      console.log('\nExcel Summary:');
      const excelTotals = {
        revenue: 0,
        costOfSales: 0,
        operatingExpenses: 0,
        otherIncome: 0
      };
      
      excelData.line_items.forEach((item: any) => {
        if (item.section === 'Turnover') excelTotals.revenue += item.amount;
        else if (item.section === 'Cost of Sales') excelTotals.costOfSales += item.amount;
        else if (item.section === 'Administrative Costs') excelTotals.operatingExpenses += item.amount;
        else if (item.section === 'Other Income') excelTotals.otherIncome += item.amount;
      });
      
      console.log(`  Revenue: £${excelTotals.revenue.toFixed(2)}`);
      console.log(`  Cost of Sales: £${excelTotals.costOfSales.toFixed(2)}`);
      console.log(`  Operating Expenses: £${excelTotals.operatingExpenses.toFixed(2)}`);
      console.log(`  Other Income: £${excelTotals.otherIncome.toFixed(2)}`);
      
      console.log('\nAPI Summary:');
      console.log(`  Revenue: £${data.totalRevenue?.toFixed(2)}`);
      console.log(`  Cost of Sales: £${data.costOfGoodsSold?.toFixed(2)}`);
      console.log(`  Operating Expenses: £${data.operatingExpenses?.toFixed(2)}`);
      console.log(`  Other Income: £${data.otherIncome?.toFixed(2)}`);
      
      console.log('\n=== Line Item Comparison ===');
      
      // Create maps for easier comparison
      const excelMap = new Map();
      excelData.line_items.forEach((item: any) => {
        excelMap.set(item.account, item);
      });
      
      const apiMap = new Map();
      lineItems.forEach((item: any) => {
        apiMap.set(item.account, item);
      });
      
      // Find matching and missing items
      const allAccounts = new Set([...excelMap.keys(), ...apiMap.keys()]);
      
      let matches = 0;
      let differences = 0;
      
      console.log('\nAccount-by-account comparison:');
      allAccounts.forEach(account => {
        const excelItem = excelMap.get(account);
        const apiItem = apiMap.get(account);
        
        if (excelItem && apiItem) {
          const diff = Math.abs(excelItem.amount - apiItem.amount);
          if (diff < 0.01) {
            matches++;
            console.log(`✅ ${account}: Excel £${excelItem.amount.toFixed(2)} = API £${apiItem.amount.toFixed(2)}`);
          } else {
            differences++;
            console.log(`❌ ${account}: Excel £${excelItem.amount.toFixed(2)} ≠ API £${apiItem.amount.toFixed(2)} (diff: £${diff.toFixed(2)})`);
          }
        } else if (excelItem && !apiItem) {
          console.log(`⚠️  ${account}: In Excel (£${excelItem.amount.toFixed(2)}) but not in API`);
        } else if (!excelItem && apiItem) {
          console.log(`⚠️  ${account}: In API (£${apiItem.amount.toFixed(2)}) but not in Excel`);
        }
      });
      
      console.log(`\n✅ Matching accounts: ${matches}`);
      console.log(`❌ Differences: ${differences}`);
      
      return true;
    } else {
      console.error('❌ Error:', data.error || data.message || 'Unknown error');
      console.error('Full response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to fetch:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Run the fetch
fetch2024PLFromAPI();