#!/usr/bin/env tsx

import { getXeroClient, executeXeroAPICall } from '../lib/xero-helpers';
import { structuredLogger } from '../lib/logger';

async function testXeroBalanceSheet() {
  try {
    console.log('🔍 Testing Xero Balance Sheet Report API directly...\n');
    
    const tenantId = 'ca9f2956-55ce-47de-8e9f-b1f74c26098f';
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Report Date: ${new Date().toISOString().split('T')[0]}\n`);
    
    // Get Xero client
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      console.error('❌ Could not get Xero client');
      return;
    }
    
    console.log('✅ Got Xero client\n');
    
    // Test 1: Get Balance Sheet Report
    console.log('📊 Fetching Balance Sheet Report...');
    const balanceSheetResponse = await executeXeroAPICall<any>(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportBalanceSheet(
        tenantId,
        undefined, // date - will use today
        3, // periods
        'MONTH' // timeframe
      )
    );
    
    console.log('✅ Balance Sheet Response received!\n');
    
    // Check the structure
    console.log('Response structure:', {
      hasBody: !!balanceSheetResponse?.body,
      hasReports: !!balanceSheetResponse?.body?.reports,
      reportsLength: balanceSheetResponse?.body?.reports?.length || 0,
      isDirectResponse: !!balanceSheetResponse?.reports
    });
    
    // Parse the report - handle both response structures
    const report = balanceSheetResponse?.body?.reports?.[0] || balanceSheetResponse?.reports?.[0];
    if (report) {
      console.log('📈 BALANCE SHEET DETAILS');
      console.log('━'.repeat(50));
      console.log(`Report Name: ${report.reportName}`);
      console.log(`Report Date: ${report.reportDate}`);
      console.log(`Updated Date: ${report.updatedDateUTC}`);
      
      // Extract key values
      const rows = report.rows || [];
      console.log(`\nTotal Sections: ${rows.length}`);
      
      rows.forEach((section: any) => {
        if (section.rowType === 'Section' && section.title) {
          console.log(`\n${section.title}:`);
          
          section.rows?.forEach((row: any) => {
            if (row.cells && row.cells.length > 0) {
              const label = row.cells[0]?.value || '';
              const values = row.cells.slice(1).map((c: any) => c.value || '0');
              if (label) {
                console.log(`  ${label}: ${values.join(' | ')}`);
              }
            }
          });
        }
      });
    }
    
    // Test 2: Get Accounts with balances using Trial Balance
    console.log('\n\n📊 Fetching Trial Balance for account balances...');
    const trialBalanceResponse = await executeXeroAPICall<any>(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportTrialBalance(
        tenantId,
        undefined // date
      )
    );
    
    const trialBalance = trialBalanceResponse?.body?.reports?.[0];
    if (trialBalance) {
      console.log('\n📈 TRIAL BALANCE SUMMARY');
      console.log('━'.repeat(50));
      
      let totalDebits = 0;
      let totalCredits = 0;
      let accountCount = 0;
      
      const tbRows = trialBalance.rows || [];
      tbRows.forEach((section: any) => {
        if (section.rowType === 'Section') {
          section.rows?.forEach((row: any) => {
            if (row.cells && row.cells.length >= 4) {
              const accountName = row.cells[0]?.value;
              const debit = parseFloat(row.cells[1]?.value || '0');
              const credit = parseFloat(row.cells[2]?.value || '0');
              
              if (accountName && (debit > 0 || credit > 0)) {
                accountCount++;
                totalDebits += debit;
                totalCredits += credit;
                
                if (accountCount <= 5) { // Show first 5 accounts
                  console.log(`${accountName}: Debit ${debit}, Credit ${credit}`);
                }
              }
            }
          });
        }
      });
      
      console.log(`\nTotal Accounts with balances: ${accountCount}`);
      console.log(`Total Debits: ${totalDebits.toFixed(2)}`);
      console.log(`Total Credits: ${totalCredits.toFixed(2)}`);
    }
    
    // Save full responses
    const fs = require('fs');
    const bsData = balanceSheetResponse?.body || balanceSheetResponse;
    if (bsData) {
      fs.writeFileSync('balance-sheet-direct.json', JSON.stringify(bsData, null, 2));
      console.log('\n💾 Balance Sheet response saved to balance-sheet-direct.json');
    } else {
      console.log('\n⚠️  No Balance Sheet data received');
    }
    
    const tbData = trialBalanceResponse?.body || trialBalanceResponse;
    if (tbData) {
      fs.writeFileSync('trial-balance-direct.json', JSON.stringify(tbData, null, 2));
      console.log('💾 Trial Balance response saved to trial-balance-direct.json');
    } else {
      console.log('⚠️  No Trial Balance data received');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testXeroBalanceSheet();