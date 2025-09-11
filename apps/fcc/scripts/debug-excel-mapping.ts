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

// Show all rows with their indices for proper mapping
console.log('=== ALL ROWS WITH VALUES ===');
data.forEach((row, i) => {
  if (row && row.length > 0 && row.some(cell => cell)) {
    // Show row number, and all non-empty cells
    const cells = row.map((cell, j) => cell ? `[${j}]: ${cell}` : '').filter(c => c);
    if (cells.length > 0) {
      console.log(`Row ${i}: ${cells.join(' | ')}`);
    }
  }
});

// Look for the specific values we expect from API
console.log('\n=== SEARCHING FOR EXPECTED VALUES ===');
const searchValues = [241145.98, 155545.12, 47264.98, 193881];
searchValues.forEach(target => {
  console.log(`\nSearching for ${target}:`);
  data.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell) {
        const cellStr = cell.toString().replace(/[£,\s]/g, '');
        const num = parseFloat(cellStr);
        if (Math.abs(num - target) < 1) {
          console.log(`  Found at Row ${i}, Col ${j}: ${cell}`);
        }
      }
    });
  });
});