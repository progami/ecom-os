#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';
import { structuredLogger } from '../lib/logger';

async function compareMayBalanceSheetFixed() {
  console.log('=== COMPARING MAY 31, 2025 BALANCE SHEET (FIXED) ===\n');
  
  try {
    // Parse the May 31st Excel file
    console.log('Step 1: Parsing May 31st Excel file...');
    const excelPath = path.join(__dirname, '../data/balance-sheet_2025-05-31.xlsx');
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csvData = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      blankrows: true
    }) as string[][];
    
    // Parse with the specific date column header
    const parsed = XeroBalanceSheetParser.parse(csvData, '31 May 2025');
    const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, new Date('2025-05-31'));
    
    console.log('\nExcel Results (May 31, 2025):');
    console.log('- Total Assets: £' + importFormat.summary.totalAssets.toFixed(2));
    console.log('- Total Liabilities: £' + importFormat.summary.totalLiabilities.toFixed(2));
    console.log('- Net Assets: £' + importFormat.summary.netAssets.toFixed(2));
    console.log('- Cash: £' + importFormat.assets.current.cash.toFixed(2));
    console.log('- Current Assets: £' + importFormat.assets.current.total.toFixed(2));
    console.log('- Current Liabilities: £' + importFormat.liabilities.current.total.toFixed(2));
    console.log('- Equity: £' + importFormat.equity.total.toFixed(2));
    
    // Show the cash calculation
    console.log('\n=== CASH BREAKDOWN ===');
    const cashAccounts = [
      { name: 'Lloyds Business Bank', value: 98.43 },
      { name: 'Payoneer Business GBP', value: 91.44 },
      { name: 'Wise Business EUR', value: 1118.58 },
      { name: 'Wise Business GBP', value: 27950.38 },
      { name: 'Wise Business PKR', value: 0.13 },
      { name: 'Wise Business USD', value: 150013.82 }
    ];
    
    cashAccounts.forEach(acc => {
      console.log(`  ${acc.name}: £${acc.value.toFixed(2)}`);
    });
    const totalCash = cashAccounts.reduce((sum, acc) => sum + acc.value, 0);
    console.log(`  TOTAL CASH: £${totalCash.toFixed(2)}`);
    
    // Compare with June data
    console.log('\n\n=== MONTH-OVER-MONTH COMPARISON ===');
    console.log('                      May 31, 2025    June 30, 2025         Change');
    console.log('--------------------------------------------------------------------');
    
    // June values from our previous test
    const juneValues = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      netAssets: 190706.27,
      cash: 155545.12,
      currentAssets: 239377.25,
      currentLiabilities: 50439.71,
      equity: 190706.27
    };
    
    const compareField = (name: string, mayVal: number, juneVal: number) => {
      const change = juneVal - mayVal;
      const changeStr = change >= 0 ? `+£${change.toFixed(2)}` : `-£${Math.abs(change).toFixed(2)}`;
      const percentChange = mayVal !== 0 ? ((change / mayVal) * 100).toFixed(1) : 'N/A';
      console.log(
        `${name.padEnd(20)} £${mayVal.toFixed(2).padStart(12)} £${juneVal.toFixed(2).padStart(12)} ${changeStr.padStart(15)} (${percentChange}%)`
      );
    };
    
    compareField('Total Assets', importFormat.summary.totalAssets, juneValues.totalAssets);
    compareField('Total Liabilities', importFormat.summary.totalLiabilities, juneValues.totalLiabilities);
    compareField('Net Assets', importFormat.summary.netAssets, juneValues.netAssets);
    compareField('Cash', importFormat.assets.current.cash, juneValues.cash);
    compareField('Current Assets', importFormat.assets.current.total, juneValues.currentAssets);
    compareField('Current Liabilities', importFormat.liabilities.current.total, juneValues.currentLiabilities);
    compareField('Equity', importFormat.equity.total, juneValues.equity);
    
    // Now test API comparison
    console.log('\n\n=== API vs EXCEL COMPARISON FOR MAY 31 ===');
    console.log('To fetch May 31st data from API, use:');
    console.log('GET /api/v1/xero/reports/balance-sheet?date=2025-05-31&source=live');
    
    // Expected API values for May 31 (you'll need to call the API to get these)
    console.log('\nOnce you call the API, compare these Excel values:');
    console.log('Excel (May 31):');
    console.log('- Total Assets: £' + importFormat.summary.totalAssets.toFixed(2));
    console.log('- Total Liabilities: £' + importFormat.summary.totalLiabilities.toFixed(2));
    console.log('- Cash: £' + importFormat.assets.current.cash.toFixed(2));
    
    console.log('\nWith API response values to verify they match (or identify differences).');
    
  } catch (error) {
    console.error('Error:', error);
    structuredLogger.error('[CompareMayBS] Failed to compare', error);
  }
}

compareMayBalanceSheetFixed();