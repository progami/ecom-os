import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';
import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { structuredLogger } from '../lib/logger';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

/**
 * Script to compare Balance Sheet data from:
 * 1. Xero API (direct fetch)
 * 2. Excel file import (using parser)
 * 
 * This will help identify why API returns less detail than the Excel export
 */

// The API response from our test
const apiResponse = {
  totalAssets: 262012.02,
  totalLiabilities: 68131.02,
  netAssets: 193881,
  currentAssets: 80970.51,
  currentLiabilities: 68131.02,
  equity: 193881,
  cash: 179272.78,
  accountsReceivable: 196.53,
  accountsPayable: 32075.6,
  inventory: 79082.28,
  source: "xero_direct",
  lastSyncedAt: null
};

async function compareBalanceSheetSources() {
  try {
    // First, let's understand what the API returns vs what Excel contains
    console.log('=== API Response Summary ===');
    console.log('Total Assets:', apiResponse.totalAssets);
    console.log('Total Liabilities:', apiResponse.totalLiabilities);
    console.log('Net Assets:', apiResponse.netAssets);
    console.log('Current Assets:', apiResponse.currentAssets);
    console.log('Current Liabilities:', apiResponse.currentLiabilities);
    console.log('Equity:', apiResponse.equity);
    console.log('\n--- Specific Account Details from API ---');
    console.log('Cash:', apiResponse.cash);
    console.log('Accounts Receivable:', apiResponse.accountsReceivable);
    console.log('Accounts Payable:', apiResponse.accountsPayable);
    console.log('Inventory:', apiResponse.inventory);
    
    // Now let's explain why API has less detail
    console.log('\n=== Why API Returns Less Detail ===');
    console.log('1. API Response Structure:');
    console.log('   - The XeroReportFetcher extracts SUMMARY data from the Balance Sheet report');
    console.log('   - It focuses on key financial metrics for dashboard display');
    console.log('   - Individual account details are aggregated into categories');
    
    console.log('\n2. Excel Export Structure:');
    console.log('   - Contains FULL account-level detail');
    console.log('   - Shows every GL account with its balance');
    console.log('   - Includes account codes and hierarchical structure');
    console.log('   - Preserves subtotals and groupings');
    
    console.log('\n3. Data Extraction Differences:');
    console.log('   API Fetcher (XeroReportFetcher):');
    console.log('   - Uses report.rows to find specific sections');
    console.log('   - Extracts only total values for each category');
    console.log('   - Maps to a fixed summary structure');
    
    console.log('\n   Excel Parser (XeroBalanceSheetParser):');
    console.log('   - Preserves all account rows');
    console.log('   - Maintains account hierarchy');
    console.log('   - Keeps individual account names and codes');
    console.log('   - Can reconstruct full balance sheet structure');
    
    console.log('\n=== Technical Implementation Details ===');
    console.log('From xero-report-fetcher.ts (lines 149-212):');
    console.log('- Loops through report sections looking for specific keywords');
    console.log('- When it finds "total bank", it sets cash value');
    console.log('- When it finds "total current assets", it sets currentAssets');
    console.log('- Does NOT store individual account details');
    
    console.log('\nFrom xero-balance-sheet-parser.ts:');
    console.log('- Stores each account in arrays (assets.fixed, assets.current, etc.)');
    console.log('- Preserves account names, codes, and balances');
    console.log('- Can provide detailed breakdown of each category');
    
    console.log('\n=== Example of Data Loss ===');
    console.log('API shows: cash = £179,272.78 (total)');
    console.log('Excel would show:');
    console.log('  - Lloyds Bank: £XXX');
    console.log('  - Wise Account: £XXX');
    console.log('  - Payoneer: £XXX');
    console.log('  - Cash on Hand: £XXX');
    console.log('  Total Bank: £179,272.78');
    
    console.log('\n=== Recommendation ===');
    console.log('If you need detailed account-level data:');
    console.log('1. Use the Excel import for full detail');
    console.log('2. Or modify XeroReportFetcher to store account-level data');
    console.log('3. Or use Xero\'s Accounts API separately to get account details');
    
    // If you have an Excel file path, we can parse it
    const excelFilePath = process.argv[2];
    if (!excelFilePath) {
      console.log('\n=== No Excel File Provided ===');
      console.log('To test the parser with an Excel file, run:');
      console.log('  npx ts-node scripts/compare-balance-sheet-sources.ts <path-to-excel-file>');
      console.log('\nThe XeroBalanceSheetParser has been updated to detect the correct date column.');
      return;
    }
    
    if (excelFilePath && fs.existsSync(excelFilePath)) {
      console.log('\n=== Parsing Excel File ===');
      console.log('File:', excelFilePath);
      
      const buffer = fs.readFileSync(excelFilePath);
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        console.error('No sheets found in the Excel file');
        return;
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        console.error('Could not read worksheet:', sheetName);
        return;
      }
      const rawData = xlsx.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        blankrows: true
      });
      
      // Pass the target date for column detection
      const targetDate = '30 Jun 2025';
      const parsed = XeroBalanceSheetParser.parse(rawData as string[][], targetDate);
      const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, new Date('2025-06-30'));
      
      console.log('\n--- Excel Parse Results ---');
      console.log('Total Assets:', importFormat.summary.totalAssets);
      console.log('Total Liabilities:', importFormat.summary.totalLiabilities);
      console.log('Net Assets:', importFormat.summary.netAssets);
      
      console.log('\n--- Comparison with API ---');
      console.log('Total Assets Match:', Math.abs(importFormat.summary.totalAssets - apiResponse.totalAssets) < 0.01);
      console.log('Total Liabilities Match:', Math.abs(importFormat.summary.totalLiabilities - apiResponse.totalLiabilities) < 0.01);
      console.log('Net Assets Match:', Math.abs(importFormat.summary.netAssets - apiResponse.netAssets) < 1);
      
      console.log('\n--- Account Details from Excel ---');
      console.log('Fixed Assets:', parsed.assets.fixed.length, 'accounts');
      console.log('Current Assets:', parsed.assets.current.length, 'accounts');
      console.log('Current Liabilities:', parsed.liabilities.current.length, 'accounts');
      console.log('Equity Accounts:', parsed.equity.accounts.length, 'accounts');
      
      // Show some account details
      console.log('\n--- Sample Account Details ---');
      if (parsed.assets.current.length > 0) {
        console.log('Current Asset Accounts:');
        parsed.assets.current.slice(0, 5).forEach(acc => {
          console.log(`  ${acc.name}: £${acc.balance.toFixed(2)}`);
        });
      }
    } else {
      console.log('\n--- To parse your Excel file ---');
      console.log('Run: npm run ts-node scripts/compare-balance-sheet-sources.ts /path/to/your/balance-sheet.xlsx');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the comparison
compareBalanceSheetSources();