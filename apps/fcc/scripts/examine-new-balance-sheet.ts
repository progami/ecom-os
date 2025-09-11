#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';

const excelPath = path.join(__dirname, '../data/TRADEMAN_ENTERPRISE_LTD_-_Balance_Sheet (1).xlsx');
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
}) as any[][];

console.log('=== EXAMINING NEW BALANCE SHEET ===');
console.log('First 10 rows:');
data.slice(0, 10).forEach((row, i) => {
  if (row && row.some(cell => cell)) {
    console.log(`Row ${i}: ${JSON.stringify(row)}`);
  }
});

// Look for the date
const dateRow = data.find(row => 
  row && row.some(cell => 
    cell && cell.toString().toLowerCase().includes('as at')
  )
);

if (dateRow) {
  console.log('\nDate found:', dateRow);
}