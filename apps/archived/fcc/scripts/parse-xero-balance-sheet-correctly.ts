import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { structuredLogger } from '../lib/logger';
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
  blankrows: true
}) as string[][];

interface ParsedBalanceSheet {
  assets: {
    fixed: { total: number; items: any[] };
    current: { total: number; items: any[] };
    total: number;
  };
  liabilities: {
    current: { total: number; items: any[] };
    total: number;
  };
  equity: {
    total: number;
    items: any[];
  };
  netAssets: number;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  // Remove currency symbols, commas, spaces, and [FX] markers
  let cleaned = value.toString().replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '').trim();
  // Handle parentheses (negative numbers)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseBalanceSheet(data: string[][]): ParsedBalanceSheet {
  const result: ParsedBalanceSheet = {
    assets: {
      fixed: { total: 0, items: [] },
      current: { total: 0, items: [] },
      total: 0
    },
    liabilities: {
      current: { total: 0, items: [] },
      total: 0
    },
    equity: {
      total: 0,
      items: []
    },
    netAssets: 0
  };

  let currentSection = '';
  let currentSubSection = '';

  // Manual calculation trackers
  let manualFixedAssets = 0;
  let manualCurrentAssets = 0;
  let manualCurrentLiabilities = 0;
  let manualEquity = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const firstCell = (row[0] || '').toString().trim();
    const lastCell = row[row.length - 1] || '';
    const secondLastCell = row.length > 1 ? row[row.length - 2] || '' : '';

    // Identify sections
    if (firstCell === 'Fixed Assets') {
      currentSection = 'fixed-assets';
      continue;
    } else if (firstCell === 'Current Assets') {
      currentSection = 'current-assets';
      continue;
    } else if (firstCell === 'Creditors: amounts falling due within one year') {
      currentSection = 'current-liabilities';
      continue;
    } else if (firstCell === 'Capital and Reserves') {
      currentSection = 'equity';
      continue;
    }

    // Identify subsections
    if (firstCell && !firstCell.startsWith('Total') && !firstCell.startsWith('Less') && 
        (row.length === 1 || (row.length > 1 && !row[1]))) {
      currentSubSection = firstCell;
      continue;
    }

    // Parse account lines
    if (row.length >= 2 && firstCell && !firstCell.includes('Total')) {
      const accountName = firstCell;
      // Try to find the value - it could be in last column or second-to-last
      let value = 0;
      if (lastCell && lastCell !== '[FX]') {
        value = parseAmount(lastCell);
      } else if (secondLastCell) {
        value = parseAmount(secondLastCell);
      }

      if (value !== 0) {
        const account = { name: accountName, value: value };

        switch (currentSection) {
          case 'fixed-assets':
            result.assets.fixed.items.push(account);
            manualFixedAssets += value;
            break;
          case 'current-assets':
            result.assets.current.items.push(account);
            manualCurrentAssets += value;
            break;
          case 'current-liabilities':
            result.liabilities.current.items.push(account);
            manualCurrentLiabilities += Math.abs(value);
            break;
          case 'equity':
            result.equity.items.push(account);
            manualEquity += value;
            break;
        }
      }
    }

    // Look for totals (even if they show 0.00, we'll use our manual calculations)
    if (firstCell.includes('Total')) {
      if (firstCell === 'Total Fixed Assets') {
        result.assets.fixed.total = manualFixedAssets;
      } else if (firstCell === 'Total Current Assets') {
        result.assets.current.total = manualCurrentAssets;
      } else if (firstCell === 'Total Creditors: amounts falling due within one year') {
        result.liabilities.current.total = manualCurrentLiabilities;
      } else if (firstCell === 'Total Capital and Reserves') {
        result.equity.total = manualEquity;
      }
    }
  }

  // Calculate totals
  result.assets.total = result.assets.fixed.total + result.assets.current.total;
  result.liabilities.total = result.liabilities.current.total;
  result.netAssets = result.assets.total - result.liabilities.total;

  // If equity wasn't calculated, derive it
  if (result.equity.total === 0) {
    result.equity.total = result.netAssets;
  }

  return result;
}

// Parse the balance sheet
const parsed = parseBalanceSheet(rawData);

console.log('=== Correctly Parsed Balance Sheet ===');
console.log('\nAssets:');
console.log('  Fixed Assets:', parsed.assets.fixed.total.toFixed(2));
console.log('  Current Assets:', parsed.assets.current.total.toFixed(2));
console.log('  TOTAL ASSETS:', parsed.assets.total.toFixed(2));

console.log('\nLiabilities:');
console.log('  Current Liabilities:', parsed.liabilities.current.total.toFixed(2));
console.log('  TOTAL LIABILITIES:', parsed.liabilities.total.toFixed(2));

console.log('\nEquity:', parsed.equity.total.toFixed(2));
console.log('NET ASSETS:', parsed.netAssets.toFixed(2));

// Show some account details
console.log('\n=== Account Details ===');
console.log('\nCurrent Assets:');
parsed.assets.current.items.forEach(item => {
  console.log(`  ${item.name}: ${item.value.toFixed(2)}`);
});

console.log('\nCurrent Liabilities:');
parsed.liabilities.current.items.forEach(item => {
  console.log(`  ${item.name}: ${Math.abs(item.value).toFixed(2)}`);
});

// Calculate specific values for comparison
const cash = parsed.assets.current.items
  .filter(item => ['Lloyds Business Bank', 'Payoneer Business GBP', 'Wise Business EUR', 
                   'Wise Business GBP', 'Wise Business PKR', 'Wise Business USD'].includes(item.name))
  .reduce((sum, item) => sum + item.value, 0);

const inventory = parsed.assets.current.items
  .filter(item => item.name.includes('Inventory'))
  .reduce((sum, item) => sum + item.value, 0);

const accountsPayable = parsed.liabilities.current.items
  .filter(item => item.name.includes('Creditors'))
  .reduce((sum, item) => sum + Math.abs(item.value), 0);

console.log('\n=== Key Metrics for API Comparison ===');
console.log('Total Cash:', cash.toFixed(2));
console.log('Inventory:', inventory.toFixed(2));
console.log('Accounts Payable:', accountsPayable.toFixed(2));

// API values for comparison
const apiValues = {
  totalAssets: 262012.02,
  totalLiabilities: 68131.02,
  netAssets: 193881,
  currentAssets: 80970.51,
  currentLiabilities: 68131.02,
  equity: 193881,
  cash: 179272.78,
  inventory: 79082.28,
  accountsPayable: 32075.6
};

console.log('\n=== COMPARISON WITH API ===');
console.log(`Total Assets: Excel ${parsed.assets.total.toFixed(2)} vs API ${apiValues.totalAssets} (Diff: ${(parsed.assets.total - apiValues.totalAssets).toFixed(2)})`);
console.log(`Total Liabilities: Excel ${parsed.liabilities.total.toFixed(2)} vs API ${apiValues.totalLiabilities} (Diff: ${(parsed.liabilities.total - apiValues.totalLiabilities).toFixed(2)})`);
console.log(`Net Assets: Excel ${parsed.netAssets.toFixed(2)} vs API ${apiValues.netAssets} (Diff: ${(parsed.netAssets - apiValues.netAssets).toFixed(2)})`);
console.log(`Current Assets: Excel ${parsed.assets.current.total.toFixed(2)} vs API ${apiValues.currentAssets} (Diff: ${(parsed.assets.current.total - apiValues.currentAssets).toFixed(2)})`);
console.log(`Cash: Excel ${cash.toFixed(2)} vs API ${apiValues.cash} (Diff: ${(cash - apiValues.cash).toFixed(2)})`);
