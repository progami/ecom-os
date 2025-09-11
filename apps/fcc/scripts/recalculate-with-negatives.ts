#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';

const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as any[][];

// Helper to parse amounts (including negatives in parentheses)
const parseAmount = (value: any): number => {
  if (!value) return 0;
  let str = value.toString().replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '');
  // Handle parentheses as negative
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1);
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

console.log('=== RECALCULATING WITH PROPER NEGATIVE HANDLING ===\n');

// Fixed Assets
const depreciationRow8 = parseAmount(data[8]?.[2]); // (319.32) = -319.32
const equipmentRow9 = parseAmount(data[9]?.[2]); // 2,088.05
const tangibleAssetsTotal = depreciationRow8 + equipmentRow9;
console.log('FIXED ASSETS:');
console.log(`  Depreciation: ${depreciationRow8}`);
console.log(`  Equipment: ${equipmentRow9}`);
console.log(`  Total Tangible: ${tangibleAssetsTotal}`);
console.log(`  Total Fixed Assets: ${tangibleAssetsTotal}\n`);

// Cash accounts
const cashAccounts = {
  lloyds: parseAmount(data[15]?.[2]), // 98.43
  payoneer: parseAmount(data[16]?.[2]), // 91.44
  wiseEUR: parseAmount(data[17]?.[2]), // 926.34
  wiseGBP: parseAmount(data[18]?.[2]), // 19,883.32
  wisePKR: parseAmount(data[19]?.[2]), // 0.13
  wiseUSD: parseAmount(data[20]?.[2]), // 134,545.46
};
const totalCash = Object.values(cashAccounts).reduce((a, b) => a + b, 0);
console.log('CASH:');
Object.entries(cashAccounts).forEach(([name, value]) => {
  console.log(`  ${name}: ${value}`);
});
console.log(`  Total Cash: ${totalCash}\n`);

// Other current assets
const otherCurrentAssets = {
  amazonReserved: parseAmount(data[22]?.[2]), // 4.52
  amazonSplit: parseAmount(data[23]?.[2]), // 0.01
  inventory: parseAmount(data[24]?.[2]), // 82,023.47
  otherDebtors: parseAmount(data[25]?.[2]), // 1,000.00
  prepayments: parseAmount(data[26]?.[2]), // 221.43
  targon: parseAmount(data[27]?.[2]), // 582.70
};
const totalOtherCurrent = Object.values(otherCurrentAssets).reduce((a, b) => a + b, 0);
console.log('OTHER CURRENT ASSETS:');
Object.entries(otherCurrentAssets).forEach(([name, value]) => {
  console.log(`  ${name}: ${value}`);
});
console.log(`  Total Other Current: ${totalOtherCurrent}`);

const totalCurrentAssets = totalCash + totalOtherCurrent;
const totalAssets = tangibleAssetsTotal + totalCurrentAssets;
console.log(`\nTOTAL CURRENT ASSETS: ${totalCurrentAssets}`);
console.log(`TOTAL ASSETS: ${totalAssets}\n`);

// Liabilities
const liabilities = {
  accountsPayable: parseAmount(data[31]?.[2]), // 14,471.58
  directorsLoan: parseAmount(data[32]?.[2]), // (25,628.75) = -25,628.75
  investmentAmjad: parseAmount(data[33]?.[2]), // 26,942.51
  investmentAmmar: parseAmount(data[34]?.[2]), // 3,733.80
  investmentHammad: parseAmount(data[35]?.[2]), // 16,743.80
  investmentJarrar: parseAmount(data[36]?.[2]), // 1,220.58
  payeNic: parseAmount(data[37]?.[2]), // 400.27
  rounding: parseAmount(data[38]?.[2]), // (266.62) = -266.62
  vat: parseAmount(data[39]?.[2]), // 12,022.54
  wagesPayable: parseAmount(data[40]?.[2]), // 800.00
};
const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
console.log('LIABILITIES:');
Object.entries(liabilities).forEach(([name, value]) => {
  console.log(`  ${name}: ${value}`);
});
console.log(`  Total Liabilities: ${totalLiabilities}\n`);

// Equity
const equity = {
  capital: parseAmount(data[50]?.[2]), // 1,000.00
  currentEarnings: parseAmount(data[51]?.[2]), // 18,937.15
  retainedEarnings: parseAmount(data[52]?.[2]), // 170,769.12
};
const totalEquity = Object.values(equity).reduce((a, b) => a + b, 0);
console.log('EQUITY:');
Object.entries(equity).forEach(([name, value]) => {
  console.log(`  ${name}: ${value}`);
});
console.log(`  Total Equity: ${totalEquity}\n`);

const netAssets = totalAssets - totalLiabilities;

console.log('=== FINAL TOTALS ===');
console.log(`Total Assets: £${totalAssets.toFixed(2)}`);
console.log(`Total Liabilities: £${totalLiabilities.toFixed(2)}`);
console.log(`Total Equity: £${totalEquity.toFixed(2)}`);
console.log(`Net Assets: £${netAssets.toFixed(2)}`);
console.log(`\nBalance Check: Assets (${totalAssets.toFixed(2)}) = Liabilities (${totalLiabilities.toFixed(2)}) + Equity (${totalEquity.toFixed(2)})`);
console.log(`Difference: £${(totalAssets - totalLiabilities - totalEquity).toFixed(2)}`);