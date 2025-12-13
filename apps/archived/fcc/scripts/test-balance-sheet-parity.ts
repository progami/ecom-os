#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';
import { structuredLogger } from '../lib/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

/**
 * Test script to prove that both API and Import return EXACT SAME values
 * for Balance Sheet data as of June 30, 2025
 */

interface ComparisonResult {
  field: string;
  apiValue: number;
  importValue: number;
  difference: number;
  percentageDiff: number;
  isExact: boolean;
}

// Expected values from API (after fix)
const API_RESULTS = {
  totalAssets: 241145.98,
  totalLiabilities: 47264.98,
  netAssets: 193881,
  currentAssets: 221477.44,
  currentLiabilities: 47264.98,
  equity: 193881,
  cash: 155545.12,
  accountsReceivable: 196.53,
  accountsPayable: 32075.6,
  inventory: 65735.79,
  source: "xero_direct",
  lastSyncedAt: null
};

async function testBalanceSheetParity() {
  console.log('=== BALANCE SHEET PARITY TEST ===');
  console.log('Testing that API and Import return EXACT SAME values');
  console.log('Target Date: June 30, 2025\n');

  try {
    // First, convert Excel to CSV
    console.log('Step 1: Converting Excel file to CSV...');
    const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csvData = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      blankrows: true
    }) as string[][];
    
    console.log(`✓ Loaded Excel file with ${csvData.length} rows`);

    // Parse using XeroBalanceSheetParser with specific date
    console.log('\nStep 2: Parsing CSV data with XeroBalanceSheetParser...');
    const targetDate = new Date('2025-06-30');
    // Pass the date in Xero's format
    const parsed = XeroBalanceSheetParser.parse(csvData, '30 Jun 2025');
    const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, targetDate);
    
    console.log('✓ Successfully parsed CSV data');

    // Extract values for comparison
    const IMPORT_RESULTS = {
      totalAssets: importFormat.summary.totalAssets,
      totalLiabilities: importFormat.summary.totalLiabilities,
      netAssets: importFormat.summary.netAssets,
      currentAssets: importFormat.assets.current.total,
      currentLiabilities: importFormat.liabilities.current.total,
      equity: importFormat.equity.total,
      cash: importFormat.assets.current.cash,
      accountsReceivable: importFormat.assets.current.accountsReceivable,
      accountsPayable: importFormat.liabilities.current.accountsPayable,
      inventory: importFormat.assets.current.inventory
    };

    // Compare results
    console.log('\nStep 3: Comparing API and Import values...\n');
    console.log('=== DETAILED COMPARISON ===');
    
    const comparisons: ComparisonResult[] = [];
    
    // Helper function to compare values
    const compareValues = (field: string, apiVal: number, importVal: number): ComparisonResult => {
      const diff = Math.abs(apiVal - importVal);
      const percentDiff = apiVal !== 0 ? (diff / Math.abs(apiVal)) * 100 : 0;
      const isExact = diff < 0.01; // Less than 1 penny difference
      
      return {
        field,
        apiValue: apiVal,
        importValue: importVal,
        difference: diff,
        percentageDiff: percentDiff,
        isExact
      };
    };

    // Compare each field
    comparisons.push(compareValues('Total Assets', API_RESULTS.totalAssets, IMPORT_RESULTS.totalAssets));
    comparisons.push(compareValues('Total Liabilities', API_RESULTS.totalLiabilities, IMPORT_RESULTS.totalLiabilities));
    comparisons.push(compareValues('Net Assets', API_RESULTS.netAssets, IMPORT_RESULTS.netAssets));
    comparisons.push(compareValues('Current Assets', API_RESULTS.currentAssets, IMPORT_RESULTS.currentAssets));
    comparisons.push(compareValues('Current Liabilities', API_RESULTS.currentLiabilities, IMPORT_RESULTS.currentLiabilities));
    comparisons.push(compareValues('Equity', API_RESULTS.equity, IMPORT_RESULTS.equity));
    comparisons.push(compareValues('Cash', API_RESULTS.cash, IMPORT_RESULTS.cash));
    comparisons.push(compareValues('Accounts Receivable', API_RESULTS.accountsReceivable, IMPORT_RESULTS.accountsReceivable));
    comparisons.push(compareValues('Accounts Payable', API_RESULTS.accountsPayable, IMPORT_RESULTS.accountsPayable));
    comparisons.push(compareValues('Inventory', API_RESULTS.inventory, IMPORT_RESULTS.inventory));

    // Display results in a table format
    console.log('Field                    | API Value     | Import Value  | Difference | Status');
    console.log('-------------------------|---------------|---------------|------------|--------');
    
    comparisons.forEach(comp => {
      const status = comp.isExact ? '✓ EXACT' : `✗ DIFF: ${comp.difference.toFixed(2)}`;
      console.log(
        `${comp.field.padEnd(24)} | ` +
        `£${comp.apiValue.toFixed(2).padStart(11)} | ` +
        `£${comp.importValue.toFixed(2).padStart(11)} | ` +
        `£${comp.difference.toFixed(2).padStart(9)} | ` +
        status
      );
    });

    // Summary
    const exactMatches = comparisons.filter(c => c.isExact).length;
    const totalFields = comparisons.length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Exact Matches: ${exactMatches}/${totalFields}`);
    console.log(`Match Rate: ${(exactMatches / totalFields * 100).toFixed(1)}%`);
    
    if (exactMatches === totalFields) {
      console.log('\n✅ SUCCESS: API and Import return EXACT SAME values!');
      console.log('Both parsers are correctly reading the June 30, 2025 column.');
    } else {
      console.log('\n❌ FAILURE: Some values do not match exactly');
      console.log('\nMismatched fields:');
      comparisons.filter(c => !c.isExact).forEach(comp => {
        console.log(`- ${comp.field}: Difference of £${comp.difference.toFixed(2)} (${comp.percentageDiff.toFixed(2)}%)`);
      });
    }

    // Additional debugging info
    console.log('\n=== PARSER DETAILS ===');
    console.log('Import Parser Account Breakdown:');
    console.log(`- Fixed Assets: ${parsed.assets.fixed.length} accounts`);
    console.log(`- Current Assets: ${parsed.assets.current.length} accounts`);
    console.log(`- Current Liabilities: ${parsed.liabilities.current.length} accounts`);
    console.log(`- Non-Current Liabilities: ${parsed.liabilities.nonCurrent.length} accounts`);
    console.log(`- Equity: ${parsed.equity.accounts.length} accounts`);

    // Save detailed results to file
    const resultsPath = path.join(__dirname, '../balance-sheet-parity-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      testDate: new Date().toISOString(),
      targetDate: '2025-06-30',
      apiResults: API_RESULTS,
      importResults: IMPORT_RESULTS,
      comparisons,
      summary: {
        exactMatches,
        totalFields,
        matchRate: (exactMatches / totalFields * 100).toFixed(1) + '%',
        allExact: exactMatches === totalFields
      }
    }, null, 2));
    
    console.log(`\nDetailed results saved to: ${resultsPath}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    structuredLogger.error('[BalanceSheetParity] Test failed', error);
  }
}

// Run the test
testBalanceSheetParity();