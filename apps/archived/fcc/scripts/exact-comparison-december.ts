import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';

async function compareDecemberData() {
  console.log('=== EXACT COMPARISON: December 2024 P&L ===\n');
  
  // Read API response
  const apiData = JSON.parse(await fs.readFile('/tmp/pl-response.json', 'utf-8'));
  
  // Read Excel file
  const workbook = XLSX.readFile('/Users/jarraramjad/Documents/ecom_os/FCC/data/TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Extract Excel accounts (matching the Python script logic)
  const excelAccounts: { [key: string]: { value: number; section: string } } = {};
  let currentSection = '';
  
  for (let i = 6; i < excelData.length; i++) {
    const row = excelData[i] as any[];
    const accountName = row[0]?.toString().trim();
    const value = row[1];
    
    if (accountName) {
      // Section headers
      if (value === undefined && !['Profit', 'Net Profit', 'Gross Profit'].includes(accountName)) {
        currentSection = accountName;
        continue;
      }
      
      // Skip totals and profit summaries
      if (accountName.startsWith('Total') || 
          ['Gross Profit', 'Net Profit', 'Profit', 'Operating Profit', 
           'Profit on Ordinary Activities Before Taxation', 'Profit after Taxation'].includes(accountName)) {
        continue;
      }
      
      // Regular accounts
      if (value !== undefined && value !== null) {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (!isNaN(numValue)) {
          excelAccounts[accountName] = {
            value: numValue,
            section: currentSection
          };
        }
      }
    }
  }
  
  // Build API accounts map
  const apiAccounts: { [key: string]: number } = {};
  
  // Add all accounts from detailed breakdown
  const breakdown = apiData.detailedBreakdown;
  
  breakdown.revenue.accounts.forEach((acc: any) => {
    apiAccounts[acc.accountName] = acc.amount;
  });
  
  breakdown.otherIncome.accounts.forEach((acc: any) => {
    apiAccounts[acc.accountName] = acc.amount;
  });
  
  breakdown.costOfGoodsSold.accounts.forEach((acc: any) => {
    apiAccounts[acc.accountName] = acc.amount;
  });
  
  breakdown.operatingExpenses.accounts.forEach((acc: any) => {
    apiAccounts[acc.accountName] = acc.amount;
  });
  
  breakdown.otherExpenses.accounts.forEach((acc: any) => {
    apiAccounts[acc.accountName] = acc.amount;
  });
  
  // Compare accounts
  console.log('ACCOUNT-BY-ACCOUNT COMPARISON:');
  console.log('='*60);
  
  let matches = 0;
  let differences = 0;
  const discrepancies: string[] = [];
  
  Object.entries(excelAccounts).forEach(([account, data]) => {
    const excelValue = data.value;
    const apiValue = apiAccounts[account] || 0;
    
    // For Amazon Refunds, check if it's a sign difference
    if (account === 'Amazon Refunds') {
      if (Math.abs(Math.abs(excelValue) - Math.abs(apiValue)) < 0.01) {
        console.log(`⚠️  SIGN ${account}:`);
        console.log(`     Excel: £${excelValue.toFixed(2)} (${data.section})`);
        console.log(`     API:   £${apiValue.toFixed(2)}`);
        console.log(`     Note: Sign difference - Excel shows as negative, API as positive\n`);
        discrepancies.push(`${account}: Sign difference`);
      } else {
        differences++;
        console.log(`❌ DIFF ${account}:`);
        console.log(`     Excel: £${excelValue.toFixed(2)} (${data.section})`);
        console.log(`     API:   £${apiValue.toFixed(2)}`);
        console.log(`     Diff:  £${(apiValue - excelValue).toFixed(2)}\n`);
        discrepancies.push(`${account}: £${excelValue.toFixed(2)} → £${apiValue.toFixed(2)}`);
      }
    } else if (Math.abs(excelValue - apiValue) < 0.01) {
      matches++;
      console.log(`✅ MATCH ${account}: £${excelValue.toFixed(2)}`);
    } else {
      differences++;
      console.log(`❌ DIFF ${account}:`);
      console.log(`     Excel: £${excelValue.toFixed(2)} (${data.section})`);
      console.log(`     API:   £${apiValue.toFixed(2)}`);
      console.log(`     Diff:  £${(apiValue - excelValue).toFixed(2)}\n`);
      discrepancies.push(`${account}: £${excelValue.toFixed(2)} → £${apiValue.toFixed(2)}`);
    }
    
    delete apiAccounts[account];
  });
  
  // Check for accounts only in API
  console.log('\nACCOUNTS ONLY IN API:');
  Object.entries(apiAccounts).forEach(([account, value]) => {
    if (value !== 0) {
      console.log(`  ${account}: £${value.toFixed(2)}`);
      discrepancies.push(`${account}: Only in API (£${value.toFixed(2)})`);
    }
  });
  
  // Summary
  console.log('\n' + '='*60);
  console.log(`SUMMARY:`);
  console.log(`✅ Matching accounts: ${matches}`);
  console.log(`❌ Different accounts: ${differences}`);
  console.log(`📊 Total accounts in Excel: ${Object.keys(excelAccounts).length}`);
  console.log(`📊 Total accounts in API: ${Object.keys(apiAccounts).length + Object.keys(excelAccounts).length}`);
  
  // Totals comparison
  console.log('\nTOTALS COMPARISON:');
  console.log('='*60);
  
  // Calculate Excel totals
  let excelRevenue = 0, excelCOGS = 0, excelOpEx = 0, excelOtherIncome = 0;
  
  Object.entries(excelAccounts).forEach(([account, data]) => {
    if (data.section === 'Turnover') excelRevenue += data.value;
    else if (data.section === 'Cost of Sales') excelCOGS += data.value;
    else if (data.section === 'Administrative Costs') excelOpEx += data.value;
    else if (data.section === 'Other Income') excelOtherIncome += data.value;
  });
  
  console.log('Revenue:');
  console.log(`  Excel: £${excelRevenue.toFixed(2)}`);
  console.log(`  API:   £${apiData.totalRevenue.toFixed(2)}`);
  console.log(`  Diff:  £${(apiData.totalRevenue - excelRevenue).toFixed(2)}`);
  
  console.log('\nCost of Goods Sold:');
  console.log(`  Excel: £${excelCOGS.toFixed(2)}`);
  console.log(`  API:   £${apiData.costOfGoodsSold.toFixed(2)}`);
  console.log(`  Diff:  £${(apiData.costOfGoodsSold - excelCOGS).toFixed(2)}`);
  
  console.log('\nOperating Expenses:');
  console.log(`  Excel: £${excelOpEx.toFixed(2)}`);
  console.log(`  API:   £${apiData.operatingExpenses.toFixed(2)}`);
  console.log(`  Diff:  £${(apiData.operatingExpenses - excelOpEx).toFixed(2)}`);
  
  console.log('\nOther Income:');
  console.log(`  Excel: £${excelOtherIncome.toFixed(2)}`);
  console.log(`  API:   £${apiData.otherIncome.toFixed(2)}`);
  console.log(`  Diff:  £${(apiData.otherIncome - excelOtherIncome).toFixed(2)}`);
  
  const excelNetProfit = excelRevenue + excelOtherIncome - excelCOGS - excelOpEx;
  console.log('\nNet Profit:');
  console.log(`  Excel: £${excelNetProfit.toFixed(2)}`);
  console.log(`  API:   £${apiData.netProfit.toFixed(2)}`);
  console.log(`  Diff:  £${(apiData.netProfit - excelNetProfit).toFixed(2)}`);
  
  console.log('\n' + '='*60);
  console.log('KEY DISCREPANCIES TO FIX:');
  discrepancies.forEach(d => console.log(`  - ${d}`));
  
  // Save results
  await fs.writeFile('/tmp/december-comparison.json', JSON.stringify({
    excelAccounts,
    apiAccounts: apiData.detailedBreakdown,
    discrepancies,
    totals: {
      excel: { revenue: excelRevenue, cogs: excelCOGS, opex: excelOpEx, otherIncome: excelOtherIncome, netProfit: excelNetProfit },
      api: { revenue: apiData.totalRevenue, cogs: apiData.costOfGoodsSold, opex: apiData.operatingExpenses, otherIncome: apiData.otherIncome, netProfit: apiData.netProfit }
    }
  }, null, 2));
  
  console.log('\nResults saved to /tmp/december-comparison.json');
}

compareDecemberData().catch(console.error);