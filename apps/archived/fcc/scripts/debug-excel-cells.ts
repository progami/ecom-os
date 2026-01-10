import * as xlsx from 'xlsx';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'data',
  'balance sheet.xlsx'
);

// Read Excel
const buffer = fs.readFileSync(filePath);
const workbook = xlsx.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get raw data
const rawData = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: false
}) as string[][];

console.log('=== Debugging Cell Values ===');

// Show specific rows with all cells
const rowsToCheck = [15, 16, 17, 18, 19, 20, 24]; // Bank accounts and inventory
rowsToCheck.forEach(rowIndex => {
  if (rawData[rowIndex]) {
    console.log(`\nRow ${rowIndex}:`);
    rawData[rowIndex].forEach((cell, colIndex) => {
      if (cell !== undefined && cell !== '') {
        console.log(`  Col ${colIndex}: "${cell}"`);
      }
    });
  }
});

// Let's also check the raw Excel range
console.log('\n=== Checking specific cells directly ===');
const cellsToCheck = ['A16', 'B16', 'C16', 'A17', 'B17', 'C17', 'A25', 'B25', 'C25'];
cellsToCheck.forEach(cellRef => {
  const cell = worksheet[cellRef];
  if (cell) {
    console.log(`${cellRef}: value="${cell.v}", type=${cell.t}, raw="${cell.w}"`);
  }
});

// Get the actual used range
const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
console.log('\n=== Worksheet Range ===');
console.log(`Columns: ${range.s.c} to ${range.e.c}`);
console.log(`Rows: ${range.s.r} to ${range.e.r}`);
