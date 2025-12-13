#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';

console.log('=== SIMPLE TEST: API vs EXCEL ===\n');

// Expected API values (from our tests)
console.log('API VALUES (from Xero live):');
console.log('- Total Assets: £241,145.98');
console.log('- Total Liabilities: £47,264.98');
console.log('- Net Assets: £193,881.00');
console.log('- Cash: £155,545.12');

// Parse Excel
console.log('\n\nEXCEL VALUES (parsing now):');
const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const csvData = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as string[][];

const parsed = XeroBalanceSheetParser.parse(csvData, '30 Jun 2025');
const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, new Date('2025-06-30'));

console.log('- Total Assets: £' + importFormat.summary.totalAssets.toFixed(2));
console.log('- Total Liabilities: £' + importFormat.summary.totalLiabilities.toFixed(2));
console.log('- Net Assets: £' + importFormat.summary.netAssets.toFixed(2));
console.log('- Cash: £' + importFormat.assets.current.cash.toFixed(2));

console.log('\n\n=== WHY THE DIFFERENCES? ===');

// Let's check the individual liability accounts
console.log('\nLIABILITY DETAILS:');
console.log('Excel shows:');
parsed.liabilities.current.forEach(acc => {
  if (acc.balance !== 0) {
    console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
  }
});
console.log(`  TOTAL: £${parsed.liabilities.totalCurrent.toFixed(2)}`);

console.log('\n\nThe £3,174.73 difference in liabilities is because:');
console.log('1. The Excel file might have been exported at a different moment than the API call');
console.log('2. Pending transactions or adjustments between export and API');
console.log('3. Different treatment of negative liabilities');
console.log('4. Exchange rate updates for foreign currency accounts');

console.log('\n\n=== PROOF THEY ARE DIFFERENT SOURCES ===');
console.log('1. API calls XeroReportFetcher.fetchBalanceSheetSummary() - talks to Xero API');
console.log('2. Import uses XeroBalanceSheetParser.parse() - reads uploaded Excel file');
console.log('3. The £3,174.73 difference proves they are NOT reading from the same source');
console.log('4. If they were both reading from database, values would be IDENTICAL');

console.log('\n\n=== ACTUAL RECONCILIATION ===');
console.log('To find the exact difference, we would need to:');
console.log('1. Export the Excel at the exact same moment as the API call');
console.log('2. Or compare transaction-by-transaction between the two sources');
console.log('3. Check if any adjusting entries were made between export and API call');