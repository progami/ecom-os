#!/usr/bin/env tsx

import * as fs from 'fs';

// Load the balance sheet data
const bsData = JSON.parse(fs.readFileSync('balance-sheet-direct.json', 'utf-8'));
const report = bsData.reports[0];

console.log('📊 Parsing Balance Sheet Report\n');

// Function to extract value from row
function extractValueFromRow(row: any): number {
  if (!row.cells || row.cells.length < 2) return 0;
  
  // Get the most recent value (last cell with a value)
  for (let i = row.cells.length - 1; i >= 1; i--) {
    const value = row.cells[i]?.value;
    if (value && value !== '') {
      const num = parseFloat(value.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    }
  }
  return 0;
}

// Function to find row by label
function findRowByLabel(rows: any[], label: string): any {
  return rows.find(row => 
    row.cells && 
    row.cells[0]?.value && 
    row.cells[0].value.toLowerCase().includes(label.toLowerCase())
  );
}

// Initialize summary
const summary = {
  totalAssets: 0,
  totalLiabilities: 0,
  netAssets: 0,
  currentAssets: 0,
  currentLiabilities: 0,
  equity: 0,
  cash: 0,
  accountsReceivable: 0,
  accountsPayable: 0,
  inventory: 0
};

// Process sections
report.rows.forEach((section: any) => {
  if (section.rowType === 'Section' && section.rows) {
    const sectionTitle = section.title?.toLowerCase() || '';
    
    section.rows.forEach((row: any) => {
      if (!row.cells || row.cells.length < 2) return;
      
      const label = row.cells[0]?.value?.toLowerCase() || '';
      const value = extractValueFromRow(row);
      
      // Bank/Cash
      if (sectionTitle.includes('bank') || label.includes('total bank')) {
        if (label.includes('total')) {
          summary.cash = value;
        }
      }
      
      // Current Assets
      if (sectionTitle.includes('current assets')) {
        if (label.includes('accounts receivable')) {
          summary.accountsReceivable = value;
        } else if (label.includes('inventory')) {
          summary.inventory += value;
        } else if (label.includes('total current assets')) {
          summary.currentAssets = value;
        }
      }
      
      // Current Liabilities
      if (sectionTitle.includes('current liabilities')) {
        if (label.includes('accounts payable')) {
          summary.accountsPayable = Math.abs(value);
        } else if (label.includes('total current liabilities')) {
          summary.currentLiabilities = Math.abs(value);
        }
      }
      
      // Total rows
      if (label.includes('total assets') && !label.includes('current')) {
        summary.totalAssets = value;
      } else if (label.includes('total liabilities') && !label.includes('current')) {
        summary.totalLiabilities = Math.abs(value);
      } else if (label.includes('total equity')) {
        summary.equity = value;
      } else if (label.includes('net assets')) {
        summary.netAssets = value;
      }
    });
  }
});

// Calculate missing values
if (summary.totalAssets === 0 && summary.cash > 0) {
  // Try to find total assets in the report
  const assetsSection = report.rows.find((r: any) => r.title === 'Assets');
  if (assetsSection && assetsSection.rows) {
    const totalRow = assetsSection.rows[assetsSection.rows.length - 1];
    if (totalRow && totalRow.cells) {
      summary.totalAssets = extractValueFromRow(totalRow);
    }
  }
}

if (summary.netAssets === 0 && summary.totalAssets > 0 && summary.totalLiabilities > 0) {
  summary.netAssets = summary.totalAssets - summary.totalLiabilities;
}

console.log('📈 EXTRACTED BALANCE SHEET SUMMARY');
console.log('━'.repeat(50));
console.log(JSON.stringify(summary, null, 2));

// Compare with actual values from report
console.log('\n📊 ACTUAL VALUES FROM REPORT');
console.log('━'.repeat(50));
console.log('Total Bank: £160,835.86');
console.log('Total Current Assets: £82,736.06');
console.log('Total Fixed Assets: £1,768.73');
console.log('Total Current Liabilities: £58,936.08');
console.log('Total Equity: £186,404.58');
console.log('\nCalculated Total Assets: £245,340.65');
console.log('Calculated Net Assets: £186,404.57');