#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { getStoredTokenSet } from '../lib/xero-client';
import { structuredLogger } from '../lib/logger';
import * as xlsx from 'xlsx';
import { XeroBalanceSheetParser } from '../lib/parsers/xero-balance-sheet-parser';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testRealDifferences() {
  console.log('=== TESTING REAL DIFFERENCES BETWEEN API AND EXCEL ===\n');
  
  try {
    // 1. Clear any cached data in database
    console.log('Step 1: Clearing any cached balance sheet data from database...');
    await prisma.reportData.deleteMany({
      where: {
        reportType: 'BALANCE_SHEET'
      }
    });
    console.log('✓ Database cache cleared\n');

    // 2. Get fresh data from Xero API
    console.log('Step 2: Fetching LIVE data from Xero API...');
    const tokenSet = await getStoredTokenSet();
    if (!tokenSet) {
      console.log('❌ No Xero token found. Please authenticate first.');
      return;
    }

    // Get tenant ID
    const user = await prisma.user.findFirst({
      where: {
        xeroTenantId: { not: null }
      }
    });

    if (!user?.xeroTenantId) {
      console.log('❌ No tenant ID found');
      return;
    }

    const asAtDate = new Date('2025-06-30');
    const apiData = await XeroReportFetcher.fetchBalanceSheetSummary(user.xeroTenantId, asAtDate);
    
    console.log('API Results (LIVE from Xero):');
    console.log('- Total Assets:', apiData.totalAssets);
    console.log('- Total Liabilities:', apiData.totalLiabilities);
    console.log('- Net Assets:', apiData.netAssets);
    console.log('- Cash:', apiData.cash);
    console.log('- Current Assets:', apiData.currentAssets);
    console.log('- Current Liabilities:', apiData.currentLiabilities);

    // 3. Parse Excel file
    console.log('\n\nStep 3: Parsing Excel file...');
    const excelPath = path.join(__dirname, '../data/balance sheet.xlsx');
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csvData = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      blankrows: true
    }) as string[][];

    const parsed = XeroBalanceSheetParser.parse(csvData, '30 Jun 2025');
    const importFormat = XeroBalanceSheetParser.toImportFormat(parsed, asAtDate);
    
    console.log('Excel Results (Parsed from file):');
    console.log('- Total Assets:', importFormat.summary.totalAssets);
    console.log('- Total Liabilities:', importFormat.summary.totalLiabilities);
    console.log('- Net Assets:', importFormat.summary.netAssets);
    console.log('- Cash:', importFormat.assets.current.cash);
    console.log('- Current Assets:', importFormat.assets.current.total);
    console.log('- Current Liabilities:', importFormat.liabilities.current.total);

    // 4. Show differences
    console.log('\n\n=== DIFFERENCES ===');
    const compareField = (field: string, apiVal: number, excelVal: number) => {
      const diff = Math.abs(apiVal - excelVal);
      const percent = apiVal !== 0 ? (diff / Math.abs(apiVal) * 100).toFixed(2) : '0';
      const status = diff < 0.01 ? '✅ MATCH' : `❌ DIFF: £${diff.toFixed(2)} (${percent}%)`;
      console.log(`${field.padEnd(20)} | API: £${apiVal.toFixed(2).padStart(10)} | Excel: £${excelVal.toFixed(2).padStart(10)} | ${status}`);
    };

    compareField('Total Assets', apiData.totalAssets, importFormat.summary.totalAssets);
    compareField('Total Liabilities', apiData.totalLiabilities, importFormat.summary.totalLiabilities);
    compareField('Net Assets', apiData.netAssets, importFormat.summary.netAssets);
    compareField('Cash', apiData.cash || 0, importFormat.assets.current.cash);
    compareField('Current Assets', apiData.currentAssets || 0, importFormat.assets.current.total);
    compareField('Current Liabilities', apiData.currentLiabilities || 0, importFormat.liabilities.current.total);

    console.log('\n\n=== EXPLANATION ===');
    console.log('If differences exist, they could be due to:');
    console.log('1. Timing: Excel exported at different time than API call');
    console.log('2. Pending transactions: New transactions between export and API call');
    console.log('3. Exchange rates: Foreign currency accounts updated');
    console.log('4. Rounding: Different rounding methods');
    console.log('5. Account mapping: Different categorization logic');
    
    // Check metadata
    console.log('\n\n=== METADATA CHECK ===');
    console.log('Excel file date: As at 30 June 2025');
    console.log('API request date: 30 June 2025');
    console.log('Current date:', new Date().toISOString());
    
    // Look for exchange rate differences
    console.log('\n=== EXCHANGE RATES ===');
    console.log('Excel shows these FX rates:');
    console.log('- EUR: 1.17380 (on 27 Jun 2025)');
    console.log('- PKR: 389.390 (on 27 Jun 2025)');
    console.log('- USD: 1.37248 (on 27 Jun 2025)');
    console.log('API might use different rates if updated after export.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealDifferences();