#!/usr/bin/env node

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../data/balance sheet.xlsx'));

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to CSV
const csvData = XLSX.utils.sheet_to_csv(worksheet);

// Save as CSV
fs.writeFileSync(path.join(__dirname, '../data/balance-sheet-june-30.csv'), csvData);

console.log('✅ Converted Excel to CSV: data/balance-sheet-june-30.csv');

// Also convert to JSON for easier inspection
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
fs.writeFileSync(
  path.join(__dirname, '../data/balance-sheet-june-30.json'), 
  JSON.stringify(jsonData, null, 2)
);

console.log('✅ Also saved as JSON: data/balance-sheet-june-30.json');

// Display first few rows
console.log('\nFirst 10 rows:');
jsonData.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}: ${JSON.stringify(row)}`);
});