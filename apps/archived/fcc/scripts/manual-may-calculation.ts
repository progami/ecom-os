#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';

const excelPath = path.join(__dirname, '../data/balance-sheet_2025-05-31.xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as any[][];

console.log('=== MANUAL CALCULATION OF MAY 31, 2025 BALANCE SHEET ===\n');

// Helper to parse amounts
const parseAmount = (value: any): number => {
  if (!value) return 0;
  let str = value.toString().replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '');
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1);
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// The values are in column 2 (index 2)
const COL = 2;

// Fixed Assets
const depreciation = parseAmount(data[8]?.[COL]); // (319.32)
const equipment = parseAmount(data[9]?.[COL]); // 2,088.05
const totalFixed = depreciation + equipment;

console.log('FIXED ASSETS:');
console.log(`  Depreciation: £${depreciation.toFixed(2)}`);
console.log(`  Equipment: £${equipment.toFixed(2)}`);
console.log(`  Total Fixed: £${totalFixed.toFixed(2)}\n`);

// Cash
const cashData = [
  { row: 15, name: 'Lloyds Business Bank' },
  { row: 16, name: 'Payoneer Business GBP' },
  { row: 17, name: 'Wise Business EUR' },
  { row: 18, name: 'Wise Business GBP' },
  { row: 19, name: 'Wise Business PKR' },
  { row: 20, name: 'Wise Business USD' }
];

console.log('CASH:');
let totalCash = 0;
cashData.forEach(({ row, name }) => {
  const value = parseAmount(data[row]?.[COL]);
  console.log(`  ${name}: £${value.toFixed(2)}`);
  totalCash += value;
});
console.log(`  Total Cash: £${totalCash.toFixed(2)}\n`);

// Other Current Assets
const otherCurrentData = [
  { row: 22, name: 'Accounts Receivable' },
  { row: 23, name: 'Amazon Reserved' },
  { row: 24, name: 'Amazon Split Month' },
  { row: 25, name: 'LMB Inventory' },
  { row: 26, name: 'Other Debtors' },
  { row: 27, name: 'Prepayments' },
  { row: 28, name: 'Targon LLC' }
];

console.log('OTHER CURRENT ASSETS:');
let totalOtherCurrent = 0;
otherCurrentData.forEach(({ row, name }) => {
  const value = parseAmount(data[row]?.[COL]);
  if (value !== 0) {
    console.log(`  ${name}: £${value.toFixed(2)}`);
    totalOtherCurrent += value;
  }
});

const totalCurrentAssets = totalCash + totalOtherCurrent;
const totalAssets = totalFixed + totalCurrentAssets;

console.log(`\nTotal Current Assets: £${totalCurrentAssets.toFixed(2)}`);
console.log(`TOTAL ASSETS: £${totalAssets.toFixed(2)}\n`);

// Liabilities
const liabilitiesData = [
  { row: 32, name: 'Accounts Payable' },
  { row: 33, name: 'Directors Loan' },
  { row: 34, name: 'Investment Amjad' },
  { row: 35, name: 'Investment Ammar' },
  { row: 36, name: 'Investment Hammad' },
  { row: 37, name: 'Investment Jarrar' },
  { row: 38, name: 'PAYE & NIC' },
  { row: 39, name: 'Rounding' },
  { row: 40, name: 'VAT' },
  { row: 41, name: 'Wages Payable' }
];

console.log('LIABILITIES:');
let totalLiabilities = 0;
liabilitiesData.forEach(({ row, name }) => {
  const value = parseAmount(data[row]?.[COL]);
  if (value !== 0) {
    console.log(`  ${name}: £${value.toFixed(2)}`);
    totalLiabilities += value;
  }
});
console.log(`  Total Liabilities: £${totalLiabilities.toFixed(2)}\n`);

// Equity
const equityData = [
  { row: 51, name: 'Capital' },
  { row: 52, name: 'Current Year Earnings' },
  { row: 53, name: 'Retained Earnings' }
];

console.log('EQUITY:');
let totalEquity = 0;
equityData.forEach(({ row, name }) => {
  const value = parseAmount(data[row]?.[COL]);
  if (value !== 0) {
    console.log(`  ${name}: £${value.toFixed(2)}`);
    totalEquity += value;
  }
});
console.log(`  Total Equity: £${totalEquity.toFixed(2)}\n`);

const netAssets = totalAssets - totalLiabilities;

console.log('=== MAY 31, 2025 SUMMARY ===');
console.log(`Total Assets: £${totalAssets.toFixed(2)}`);
console.log(`Total Liabilities: £${totalLiabilities.toFixed(2)}`);
console.log(`Net Assets: £${netAssets.toFixed(2)}`);
console.log(`Total Equity: £${totalEquity.toFixed(2)}`);
console.log(`\nBalance Check: Assets (${totalAssets.toFixed(2)}) = Liabilities (${totalLiabilities.toFixed(2)}) + Equity (${totalEquity.toFixed(2)})`);
console.log(`Difference: £${(totalAssets - totalLiabilities - totalEquity).toFixed(2)}`);

// Compare with June
console.log('\n\n=== COMPARISON WITH JUNE 30, 2025 ===');
console.log('                    May 31         June 30        Change');
console.log('--------------------------------------------------------');
console.log(`Total Assets:       £${totalAssets.toFixed(2).padStart(10)}  £241,145.98   ${totalAssets < 241145.98 ? '+' : '-'}£${Math.abs(241145.98 - totalAssets).toFixed(2)}`);
console.log(`Total Liabilities:  £${totalLiabilities.toFixed(2).padStart(10)}  £50,439.71    ${totalLiabilities < 50439.71 ? '+' : '-'}£${Math.abs(50439.71 - totalLiabilities).toFixed(2)}`);
console.log(`Cash:               £${totalCash.toFixed(2).padStart(10)}  £155,545.12   ${totalCash < 155545.12 ? '+' : '-'}£${Math.abs(155545.12 - totalCash).toFixed(2)}`);