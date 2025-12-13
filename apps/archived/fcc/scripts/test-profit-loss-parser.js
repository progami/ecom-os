const { XeroProfitLossParser } = require('../dist/xero-profit-loss-parser.js');

// Test data - simulating what might be in a CSV
const testData = [
  ['Profit & Loss'],
  ['Your Company'],
  ['1 June 2025 to 30 June 2025'],
  [''],
  ['Account', 'Jun-25'],
  [''],
  ['Income'],
  ['Sales', '10000.00'],
  ['Other Revenue', '500.00'],
  ['Total Income', '10500.00'],
  [''],
  ['Cost of Sales'],
  ['Purchases', '3000.00'],
  ['Total Cost of Sales', '3000.00'],
  [''],
  ['Gross Profit', '7500.00'],
  [''],
  ['Operating Expenses'],
  ['Advertising', '500.00'],
  ['Bank Fees', '100.00'],
  ['Consulting & Accounting', '1000.00'],
  ['Total Operating Expenses', '1600.00'],
  [''],
  ['Net Profit', '5900.00']
];

console.log('Testing XeroProfitLossParser with sample data...\n');

try {
  const parsed = XeroProfitLossParser.parse(testData);
  console.log('Parsed structure:', JSON.stringify(parsed, null, 2));
  
  const importFormat = XeroProfitLossParser.toImportFormat(
    parsed,
    new Date('2025-06-01'),
    new Date('2025-06-30')
  );
  
  console.log('\nImport format:', JSON.stringify(importFormat, null, 2));
  
} catch (error) {
  console.error('Error:', error);
}