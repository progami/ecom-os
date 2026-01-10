import * as xlsx from 'xlsx';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'data',
  'balance sheet.xlsx'
);

// Read and debug the Excel structure
const buffer = fs.readFileSync(filePath);
const workbook = xlsx.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get raw data
const rawData = xlsx.utils.sheet_to_json(worksheet, { 
  header: 1,
  raw: false,
  blankrows: true
});

// Show first 30 rows to understand structure
console.log('=== First 30 rows of Balance Sheet ===');
rawData.slice(0, 30).forEach((row: any, index: number) => {
  if (row && row.length > 0 && row.some((cell: any) => cell)) {
    console.log(`Row ${index}:`, row.filter((cell: any) => cell).join(' | '));
  }
});

// Look for totals
console.log('\n=== Looking for Total rows ===');
rawData.forEach((row: any, index: number) => {
  if (row && row.length > 0) {
    const firstCell = row[0]?.toString() || '';
    if (firstCell.toLowerCase().includes('total')) {
      console.log(`Row ${index}: ${row.join(' | ')}`);
    }
  }
});

// Get data as objects to see column headers
const objectData = xlsx.utils.sheet_to_json(worksheet);
console.log('\n=== First 5 rows as objects ===');
console.log(JSON.stringify(objectData.slice(0, 5), null, 2));
