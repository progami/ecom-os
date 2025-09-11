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

console.log('=== DEBUGGING MAY BALANCE SHEET STRUCTURE ===\n');

// Show the header rows
console.log('First 10 rows with all columns:');
data.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}:`, row.map((cell, j) => `[${j}]: ${cell || ''}`).join(' | '));
});

// Look for the actual data column
console.log('\n\nLooking for rows with numerical values:');
data.forEach((row, i) => {
  if (row && row.length > 2) {
    // Check if row has a number in column 2
    const col2 = row[2];
    if (col2 && /[\d,]+/.test(col2.toString())) {
      console.log(`Row ${i}: [1]: ${row[1] || ''} | [2]: ${row[2] || ''}`);
    }
  }
});

// Find date header row
console.log('\n\nSearching for date headers:');
data.slice(0, 10).forEach((row, i) => {
  row.forEach((cell, j) => {
    if (cell && cell.toString().includes('May 2025')) {
      console.log(`Found date at Row ${i}, Col ${j}: "${cell}"`);
    }
  });
});