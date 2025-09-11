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

// Look around rows 20 and 52 which have large values
console.log('Looking for actual totals around the large values:');
for (let i = 15; i <= 55; i++) {
  const row = data[i];
  if (row && row.length > 0) {
    const firstCell = (row[0] || '').toString().trim();
    const secondCell = (row[1] || '').toString().trim();
    const valueCell = row[2] || '';
    
    // Show rows with "Total" or significant values
    if (firstCell.includes('Total') || secondCell.includes('Total') || 
        firstCell.includes('Net') || secondCell.includes('Net') ||
        (valueCell && parseFloat(valueCell.toString().replace(/[£,]/g, '')) > 10000)) {
      console.log(`Row ${i}: [${firstCell}] [${secondCell}] [${valueCell}]`);
    }
  }
}

// Also check if there are more columns
console.log('\nChecking if there are more columns with data:');
const rowsWithMultipleColumns = data.filter(row => row.length > 3);
console.log(`Rows with more than 3 columns: ${rowsWithMultipleColumns.length}`);
if (rowsWithMultipleColumns.length > 0) {
  console.log('Sample row with multiple columns:', rowsWithMultipleColumns[0]);
}