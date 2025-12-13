#!/usr/bin/env node

import * as xlsx from 'xlsx';
import * as path from 'path';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';
import { structuredLogger } from '../lib/logger';

async function compareMayBalanceSheet() {
  console.log('=== COMPARING MAY 31, 2025 BALANCE SHEET ===\n');
  
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
    
    // Parse with the specific date column
    const parsed = XeroBalanceSheetParser.parse(csvData, '31 May 2025');
    const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, new Date('2025-05-31'));
    
    console.log('\nExcel Results (May 31, 2025):');
    console.log('- Total Assets: £' + importFormat.summary.totalAssets.toFixed(2));
    console.log('- Total Liabilities: £' + importFormat.summary.totalLiabilities.toFixed(2));
    console.log('- Net Assets: £' + importFormat.summary.netAssets.toFixed(2));
    console.log('- Cash: £' + importFormat.assets.current.cash.toFixed(2));
    console.log('- Current Assets: £' + importFormat.assets.current.total.toFixed(2));
    console.log('- Current Liabilities: £' + importFormat.liabilities.current.total.toFixed(2));
    
    // Show account details
    console.log('\n=== ACCOUNT DETAILS ===');
    
    console.log('\nCASH ACCOUNTS:');
    parsed.assets.current.forEach(acc => {
      const lowerName = acc.name.toLowerCase();
      if (lowerName.includes('cash') || lowerName.includes('bank') || 
          lowerName.includes('wise') || lowerName.includes('lloyds') || 
          lowerName.includes('payoneer')) {
        console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
      }
    });
    
    console.log('\nLIABILITIES:');
    parsed.liabilities.current.forEach(acc => {
      if (acc.balance !== 0 && !acc.name.includes('Total')) {
        console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
      }
    });
    
    console.log('\nEQUITY:');
    parsed.equity.accounts.forEach(acc => {
      if (acc.balance !== 0) {
        console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
      }
    });
    
    // Compare with June data
    console.log('\n\n=== COMPARISON WITH JUNE 30, 2025 ===');
    console.log('                      May 31, 2025    June 30, 2025    Change');
    console.log('----------------------------------------------------------------');
    
    // June values from our previous test
    const juneValues = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      netAssets: 190706.27,
      cash: 155545.12,
      currentAssets: 239377.25,
      currentLiabilities: 50439.71
    };
    
    const compareField = (name: string, mayVal: number, juneVal: number) => {
      const change = juneVal - mayVal;
      const changeStr = change >= 0 ? `+£${change.toFixed(2)}` : `-£${Math.abs(change).toFixed(2)}`;
      console.log(
        `${name.padEnd(20)} £${mayVal.toFixed(2).padStart(12)} £${juneVal.toFixed(2).padStart(12)} ${changeStr.padStart(15)}`
      );
    };
    
    compareField('Total Assets', importFormat.summary.totalAssets, juneValues.totalAssets);
    compareField('Total Liabilities', importFormat.summary.totalLiabilities, juneValues.totalLiabilities);
    compareField('Net Assets', importFormat.summary.netAssets, juneValues.netAssets);
    compareField('Cash', importFormat.assets.current.cash, juneValues.cash);
    compareField('Current Assets', importFormat.assets.current.total, juneValues.currentAssets);
    compareField('Current Liabilities', importFormat.liabilities.current.total, juneValues.currentLiabilities);
    
    console.log('\n=== API COMPARISON ===');
    console.log('To compare with API data for May 31, 2025:');
    console.log('1. Call /api/v1/xero/reports/balance-sheet?date=2025-05-31&source=live');
    console.log('2. This will fetch live data from Xero for May 31st');
    console.log('3. Compare the values to see if they match the Excel export');
    
    console.log('\n=== TEST ENDPOINT ===');
    console.log('You can test the API with:');
    console.log('curl "http://localhost:3000/api/v1/xero/reports/balance-sheet?date=2025-05-31&source=live" \\');
    console.log('  -H "Cookie: your-auth-cookie"');
    
  } catch (error) {
    console.error('Error:', error);
    structuredLogger.error('[CompareMayBS] Failed to compare', error);
  }
}

compareMayBalanceSheet();