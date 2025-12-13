#!/usr/bin/env node

console.log('=== MAY 31, 2025 - API vs EXCEL COMPARISON TEST ===\n');

// Excel values (calculated manually from the file)
const excelValues = {
  date: '2025-05-31',
  totalAssets: 262012.02,
  totalLiabilities: 68131.02,
  netAssets: 193881.00,
  cash: 179272.78,
  currentAssets: 260243.29,
  currentLiabilities: 68131.02,
  equity: 193881.00,
  
  // Key accounts
  inventory: 79082.28,
  accountsReceivable: 196.53,
  accountsPayable: 32075.60,
  vat: 12109.83
};

console.log('EXCEL VALUES (May 31, 2025):');
console.log('- Total Assets: £' + excelValues.totalAssets.toFixed(2));
console.log('- Total Liabilities: £' + excelValues.totalLiabilities.toFixed(2));
console.log('- Net Assets: £' + excelValues.netAssets.toFixed(2));
console.log('- Cash: £' + excelValues.cash.toFixed(2));
console.log('- Current Assets: £' + excelValues.currentAssets.toFixed(2));
console.log('- Inventory: £' + excelValues.inventory.toFixed(2));

console.log('\n=== TO TEST WITH API ===');
console.log('1. Call the API endpoint:');
console.log('   GET /api/v1/xero/reports/balance-sheet?date=2025-05-31&source=live');
console.log('\n2. Compare the API response with these Excel values');
console.log('\n3. Expected result: Values should match exactly or have minimal differences');

console.log('\n=== MONTH-OVER-MONTH CHANGES (May vs June) ===');
const juneValues = {
  totalAssets: 241145.98,
  totalLiabilities: 50439.71,
  netAssets: 190706.27,
  cash: 155545.12
};

console.log(`Total Assets: £${excelValues.totalAssets.toFixed(2)} → £${juneValues.totalAssets.toFixed(2)} (${(juneValues.totalAssets - excelValues.totalAssets).toFixed(2)})`);
console.log(`Total Liabilities: £${excelValues.totalLiabilities.toFixed(2)} → £${juneValues.totalLiabilities.toFixed(2)} (${(juneValues.totalLiabilities - excelValues.totalLiabilities).toFixed(2)})`);
console.log(`Cash: £${excelValues.cash.toFixed(2)} → £${juneValues.cash.toFixed(2)} (${(juneValues.cash - excelValues.cash).toFixed(2)})`);

console.log('\n=== KEY FINDINGS ===');
console.log('1. Total Assets DECREASED by £20,866.04 from May to June');
console.log('2. Liabilities DECREASED by £17,691.31');
console.log('3. Cash DECREASED by £23,727.66');
console.log('4. This suggests significant cash outflow or asset reduction in June');

console.log('\n=== PARSER FIX NEEDED ===');
console.log('The XeroBalanceSheetParser is incorrectly detecting date columns.');
console.log('It finds "As at 31 May 2025" instead of the column header "31 May 2025"');
console.log('This causes it to use the wrong column (0 instead of 2) for values.');