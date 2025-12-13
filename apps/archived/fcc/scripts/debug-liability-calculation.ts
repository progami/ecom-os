#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const csvData = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as string[][];

console.log('=== DEBUGGING LIABILITY CALCULATION ===\n');

// Parse using the parser
const parsed = XeroBalanceSheetParser.parse(csvData, '30 Jun 2025');

console.log('Current Liabilities from parser:');
parsed.liabilities.current.forEach(acc => {
  console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
});
console.log(`Total Current Liabilities: £${parsed.liabilities.totalCurrent.toFixed(2)}`);

// Now let's manually calculate what it should be
console.log('\n=== MANUAL CALCULATION ===');
console.log('From my analysis, liabilities should be:');
console.log('  Accounts Payable: £14,471.58');
console.log('  Directors Loan: £-25,628.75 (NEGATIVE - it\'s an asset)');
console.log('  Investment Amjad: £26,942.51');
console.log('  Investment Ammar: £3,733.80');
console.log('  Investment Hammad: £16,743.80');
console.log('  Investment Jarrar: £1,220.58');
console.log('  PAYE & NIC: £400.27');
console.log('  Rounding: £-266.62 (NEGATIVE)');
console.log('  VAT: £12,022.54');
console.log('  Wages Payable: £800.00');

const correctTotal = 14471.58 - 25628.75 + 26942.51 + 3733.80 + 16743.80 + 1220.58 + 400.27 - 266.62 + 12022.54 + 800.00;
console.log(`\nCorrect Total: £${correctTotal.toFixed(2)}`);

// The issue: Negative liabilities (like Directors' Loan -25,628.75) should reduce total liabilities
// but the parser is storing them as positive values

console.log('\n=== CASH ACCOUNTS ===');
console.log('Cash accounts in current assets:');
parsed.assets.current.forEach(acc => {
  const lowerName = acc.name.toLowerCase();
  if (lowerName.includes('cash') || lowerName.includes('bank') || 
      lowerName.includes('wise') || lowerName.includes('lloyds') || 
      lowerName.includes('payoneer')) {
    console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
  }
});

// Check toImportFormat method
const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, new Date('2025-06-30'));
console.log('\n=== IMPORT FORMAT CASH ===');
console.log(`Cash from toImportFormat: £${importFormat.assets.current.cash.toFixed(2)}`);
console.log('This should be £155,545.12');

console.log('\n=== PROBLEM IDENTIFIED ===');
console.log('1. Negative liabilities are being converted to positive (abs value)');
console.log('2. toImportFormat is not finding cash accounts by name patterns');