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

// Helper to parse amounts
const parseAmount = (value: any): number => {
  if (!value) return 0;
  const str = value.toString().replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Calculate totals manually
console.log('=== Calculating Balance Sheet Totals from Individual Accounts ===\n');

// Fixed Assets
console.log('FIXED ASSETS:');
const fixedAssets = [
  { row: 8, name: 'Less Accumulated Depreciation', value: data[8]?.[2] },
  { row: 9, name: 'Office Equipment', value: data[9]?.[2] }
];
let totalFixed = 0;
fixedAssets.forEach(({ row, name, value }) => {
  const amount = parseAmount(value);
  console.log(`  ${name}: ${value} = ${amount}`);
  totalFixed += amount;
});
console.log(`  TOTAL FIXED ASSETS: £${totalFixed.toFixed(2)}\n`);

// Current Assets - Cash
console.log('CURRENT ASSETS - CASH:');
const cashAccounts = [
  { row: 16, name: 'Lloyds Business Bank', value: data[16]?.[2] },
  { row: 17, name: 'Payoneer Business GBP', value: data[17]?.[2] },
  { row: 18, name: 'Wise Business EUR', value: data[18]?.[2] },
  { row: 19, name: 'Wise Business GBP', value: data[19]?.[2] },
  { row: 20, name: 'Wise Business PKR', value: data[20]?.[2] },
  { row: 21, name: 'Wise Business USD', value: data[21]?.[2] }
];
let totalCash = 0;
cashAccounts.forEach(({ row, name, value }) => {
  const amount = parseAmount(value);
  console.log(`  ${name}: ${value} = ${amount}`);
  totalCash += amount;
});
console.log(`  TOTAL CASH: £${totalCash.toFixed(2)}\n`);

// Other Current Assets
console.log('OTHER CURRENT ASSETS:');
const otherCurrentAssets = [
  { row: 23, name: 'Accounts Receivable', value: data[23]?.[2] },
  { row: 25, name: 'LMB Inventory', value: data[25]?.[2] },
  { row: 26, name: 'Prepayments', value: data[26]?.[2] }
];
let totalOtherCurrent = 0;
otherCurrentAssets.forEach(({ row, name, value }) => {
  const amount = parseAmount(value);
  console.log(`  ${name}: ${value} = ${amount}`);
  totalOtherCurrent += amount;
});
const totalCurrentAssets = totalCash + totalOtherCurrent;
console.log(`  TOTAL CURRENT ASSETS: £${totalCurrentAssets.toFixed(2)}\n`);

// Total Assets
const totalAssets = totalFixed + totalCurrentAssets;
console.log(`TOTAL ASSETS: £${totalAssets.toFixed(2)}\n`);

// Current Liabilities
console.log('CURRENT LIABILITIES:');
const currentLiabilities = [
  { row: 32, name: 'Accounts Payable', value: data[32]?.[2] },
  { row: 34, name: 'Investment Amjad Ali', value: data[34]?.[2] },
  { row: 36, name: 'Investment Hammad', value: data[36]?.[2] },
  { row: 38, name: 'PAYE & NIC Payable', value: data[38]?.[2] },
  { row: 40, name: 'VAT', value: data[40]?.[2] }
];
let totalCurrentLiab = 0;
currentLiabilities.forEach(({ row, name, value }) => {
  const amount = parseAmount(value);
  console.log(`  ${name}: ${value} = ${amount}`);
  totalCurrentLiab += amount;
});
console.log(`  TOTAL CURRENT LIABILITIES: £${totalCurrentLiab.toFixed(2)}\n`);

// Equity
console.log('EQUITY:');
const equity = [
  { row: 51, name: 'Capital', value: data[51]?.[2] },
  { row: 52, name: 'Current Year Earnings', value: data[52]?.[2] },
  { row: 53, name: 'Retained Earnings', value: data[53]?.[2] }
];
let totalEquity = 0;
equity.forEach(({ row, name, value }) => {
  const amount = parseAmount(value);
  console.log(`  ${name}: ${value} = ${amount}`);
  totalEquity += amount;
});
console.log(`  TOTAL EQUITY: £${totalEquity.toFixed(2)}\n`);

// Net Assets
const netAssets = totalAssets - totalCurrentLiab;
console.log(`NET ASSETS: £${netAssets.toFixed(2)}\n`);

// Summary
console.log('=== SUMMARY ===');
console.log(`Total Assets: £${totalAssets.toFixed(2)}`);
console.log(`Total Liabilities: £${totalCurrentLiab.toFixed(2)}`);
console.log(`Total Equity: £${totalEquity.toFixed(2)}`);
console.log(`Net Assets: £${netAssets.toFixed(2)}`);
console.log(`\nExpected from API:`);
console.log(`Total Assets: £241,145.98`);
console.log(`Total Liabilities: £47,264.98`);
console.log(`Net Assets: £193,881.00`);