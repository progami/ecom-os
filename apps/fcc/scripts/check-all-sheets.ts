#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';

const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
const workbook = xlsx.readFile(excelPath);

console.log('Sheets in workbook:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName, index) => {
  console.log(`\n=== Sheet ${index + 1}: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { 
    header: 1,
    raw: false,
    blankrows: true
  }) as any[][];
  
  // Show first 5 and last 5 rows
  console.log('First 5 rows:');
  data.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row));
  });
  
  console.log('\nLast 5 rows:');
  const startIdx = Math.max(0, data.length - 5);
  data.slice(startIdx).forEach((row, i) => {
    console.log(`Row ${startIdx + i}:`, JSON.stringify(row));
  });
  
  // Look for rows with large numbers
  console.log('\nRows with values > 100,000:');
  data.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell && typeof cell === 'string') {
        const numStr = cell.replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '');
        const num = parseFloat(numStr);
        if (!isNaN(num) && num > 100000) {
          console.log(`Row ${i}, Col ${j}: ${cell}`);
        }
      }
    });
  });
});