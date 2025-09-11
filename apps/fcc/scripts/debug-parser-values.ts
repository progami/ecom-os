#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';

const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as string[][];

// Show rows that contain Total lines
console.log('Rows containing totals:');
data.forEach((row, i) => {
  const firstCell = row[0] || row[1] || '';
  if (firstCell.toString().toLowerCase().includes('total') || 
      firstCell.toString().includes('Net Assets')) {
    console.log(`Row ${i}:`, JSON.stringify(row));
  }
});

// Look at specific important rows
console.log('\nKey value rows:');
const keyRows = [
  { row: 11, desc: 'Total Fixed Assets' },
  { row: 35, desc: 'Total Current Assets' },
  { row: 37, desc: 'Total Assets' },
  { row: 51, desc: 'Total Current Liabilities' },
  { row: 53, desc: 'Total Liabilities' },
  { row: 55, desc: 'Net Assets' },
  { row: 59, desc: 'Total Equity' }
];

keyRows.forEach(({ row, desc }) => {
  if (data[row]) {
    console.log(`Row ${row} (${desc}):`, JSON.stringify(data[row]));
  }
});

// Test the parser with debug mode
console.log('\n=== Testing Parser ===');
const parsed = XeroBalanceSheetParser.parse(data, '30 Jun 2025');
console.log('Parsed totals:', {
  totalAssets: parsed.assets.totalAssets,
  totalLiabilities: parsed.liabilities.totalLiabilities,
  netAssets: parsed.netAssets
});