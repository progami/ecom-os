const XLSX = require('xlsx');
const path = require('path');

// Path to the balance sheet file
const filePath = path.join(__dirname, '../data/balance sheet.xlsx');

try {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    raw: true,
    defval: null
  });
  
  console.log('=== BALANCE SHEET ANALYSIS - TRADEMAN ENTERPRISE LTD ===');
  console.log('As at 30 June 2025\n');
  
  // Extract all account values
  const accounts = {
    fixedAssets: {
      'Office Equipment': 2088.05,
      'Less Accumulated Depreciation on Office Equipment': -319.32
    },
    cashAccounts: {
      'Lloyds Business Bank': 98.43,
      'Payoneer Business GBP': 91.44,
      'Wise Business EUR': 926.34,
      'Wise Business GBP': 19883.32,
      'Wise Business PKR': 0.13,
      'Wise Business USD': 134545.46
    },
    otherCurrentAssets: {
      'Amazon Reserved Balances': 4.52,
      'Amazon Split Month Rollovers': 0.01,
      'LMB Inventory': 82023.47,
      'Other Debtors': 1000.00,
      'Prepayments': 221.43,
      'Targon LLC': 582.70
    },
    currentLiabilities: {
      'Accounts Payable': 14471.58,
      'Directors\' Loan Account': -25628.75,
      'Investment Amjad Ali': 26942.51,
      'Investment Ammar': 3733.80,
      'Investment Hammad': 16743.80,
      'Investment Jarrar': 1220.58,
      'PAYE & NIC Payable': 400.27,
      'Rounding': -266.62,
      'VAT': 12022.54,
      'Wages Payable - Payroll': 800.00
    },
    equity: {
      'Capital - x,xxx Ordinary Shares': 1000.00,
      'Current Year Earnings': 18937.15,
      'Retained Earnings': 170769.12
    }
  };
  
  // Calculate totals
  const totalFixedAssets = Object.values(accounts.fixedAssets).reduce((sum, val) => sum + val, 0);
  const totalCash = Object.values(accounts.cashAccounts).reduce((sum, val) => sum + val, 0);
  const totalOtherCurrentAssets = Object.values(accounts.otherCurrentAssets).reduce((sum, val) => sum + val, 0);
  const totalCurrentAssets = totalCash + totalOtherCurrentAssets;
  const totalAssets = totalFixedAssets + totalCurrentAssets;
  const totalCurrentLiabilities = Object.values(accounts.currentLiabilities).reduce((sum, val) => sum + val, 0);
  const totalEquity = Object.values(accounts.equity).reduce((sum, val) => sum + val, 0);
  const netAssets = totalAssets - totalCurrentLiabilities;
  
  // Print detailed breakdown
  console.log('=== FIXED ASSETS ===');
  Object.entries(accounts.fixedAssets).forEach(([name, value]) => {
    console.log(`${name}: £${value.toFixed(2)}`);
  });
  console.log(`Total Fixed Assets: £${totalFixedAssets.toFixed(2)}`);
  
  console.log('\n=== CURRENT ASSETS ===');
  console.log('Cash at bank and in hand:');
  Object.entries(accounts.cashAccounts).forEach(([name, value]) => {
    console.log(`  ${name}: £${value.toFixed(2)}`);
  });
  console.log(`  Total Cash: £${totalCash.toFixed(2)}`);
  
  console.log('\nOther Current Assets:');
  Object.entries(accounts.otherCurrentAssets).forEach(([name, value]) => {
    console.log(`  ${name}: £${value.toFixed(2)}`);
  });
  console.log(`  Total Other Current Assets: £${totalOtherCurrentAssets.toFixed(2)}`);
  console.log(`Total Current Assets: £${totalCurrentAssets.toFixed(2)}`);
  
  console.log('\n=== CURRENT LIABILITIES ===');
  Object.entries(accounts.currentLiabilities).forEach(([name, value]) => {
    console.log(`${name}: £${value.toFixed(2)}`);
  });
  console.log(`Total Current Liabilities: £${totalCurrentLiabilities.toFixed(2)}`);
  
  console.log('\n=== EQUITY ===');
  Object.entries(accounts.equity).forEach(([name, value]) => {
    console.log(`${name}: £${value.toFixed(2)}`);
  });
  console.log(`Total Equity: £${totalEquity.toFixed(2)}`);
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total Fixed Assets: £${totalFixedAssets.toFixed(2)}`);
  console.log(`Total Current Assets: £${totalCurrentAssets.toFixed(2)}`);
  console.log(`TOTAL ASSETS: £${totalAssets.toFixed(2)}`);
  console.log(`Total Current Liabilities: £${totalCurrentLiabilities.toFixed(2)}`);
  console.log(`NET ASSETS: £${netAssets.toFixed(2)}`);
  console.log(`Total Equity: £${totalEquity.toFixed(2)}`);
  
  // Verify balance sheet equation
  const difference = Math.abs(netAssets - totalEquity);
  console.log(`\nBalance Sheet Check: ${difference < 0.01 ? '✓ BALANCED' : '✗ NOT BALANCED (diff: £' + difference.toFixed(2) + ')'}`);
  
  console.log('\n=== COMPARISON WITH API VALUES ===');
  const apiValues = {
    totalAssets: 262012.02,
    totalLiabilities: 68131.02,
    netAssets: 193881.00,
    cash: 179272.78,
    inventory: 79082.28
  };
  
  console.log(`\nTotal Assets:`);
  console.log(`  Excel: £${totalAssets.toFixed(2)}`);
  console.log(`  API: £${apiValues.totalAssets.toFixed(2)}`);
  console.log(`  Difference: £${(apiValues.totalAssets - totalAssets).toFixed(2)}`);
  
  console.log(`\nTotal Liabilities:`);
  console.log(`  Excel: £${totalCurrentLiabilities.toFixed(2)}`);
  console.log(`  API: £${apiValues.totalLiabilities.toFixed(2)}`);
  console.log(`  Difference: £${(apiValues.totalLiabilities - totalCurrentLiabilities).toFixed(2)}`);
  
  console.log(`\nNet Assets:`);
  console.log(`  Excel: £${netAssets.toFixed(2)}`);
  console.log(`  API: £${apiValues.netAssets.toFixed(2)}`);
  console.log(`  Difference: £${(apiValues.netAssets - netAssets).toFixed(2)}`);
  
  console.log(`\nCash:`);
  console.log(`  Excel: £${totalCash.toFixed(2)}`);
  console.log(`  API: £${apiValues.cash.toFixed(2)}`);
  console.log(`  Difference: £${(apiValues.cash - totalCash).toFixed(2)}`);
  
  console.log(`\nInventory:`);
  console.log(`  Excel: £${accounts.otherCurrentAssets['LMB Inventory'].toFixed(2)}`);
  console.log(`  API: £${apiValues.inventory.toFixed(2)}`);
  console.log(`  Difference: £${(apiValues.inventory - accounts.otherCurrentAssets['LMB Inventory']).toFixed(2)}`);
  
  // Foreign currency information
  console.log('\n=== FOREIGN CURRENCY ACCOUNTS ===');
  console.log('Exchange rates used (as per file notes):');
  console.log('  EUR: 1.17380 (27 Jun 2025)');
  console.log('  PKR: 389.390 (27 Jun 2025)');
  console.log('  USD: 1.37248 (27 Jun 2025)');
  console.log('\nForeign currency account balances:');
  console.log(`  Wise Business EUR: £${accounts.cashAccounts['Wise Business EUR'].toFixed(2)}`);
  console.log(`  Wise Business PKR: £${accounts.cashAccounts['Wise Business PKR'].toFixed(2)}`);
  console.log(`  Wise Business USD: £${accounts.cashAccounts['Wise Business USD'].toFixed(2)}`);
  
} catch (error) {
  console.error('Error:', error);
}