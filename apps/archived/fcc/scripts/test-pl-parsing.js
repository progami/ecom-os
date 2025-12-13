#!/usr/bin/env node

/**
 * Test script to debug P&L parsing from Xero
 * This script will fetch P&L data and log the raw structure
 */

const { XeroReportFetcher } = require('../lib/xero-report-fetcher');
const { getTenantId, getXeroClient } = require('../lib/xero-helpers');
const fs = require('fs');
const path = require('path');

async function testPLParsing() {
  console.log('Starting P&L parsing test...\n');
  
  try {
    // Get Xero client
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      throw new Error('Xero client not available');
    }
    
    // Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID found');
    }
    
    console.log(`Found tenant ID: ${tenantId}\n`);
    
    // Set date range - last 3 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    
    console.log(`Fetching P&L for period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);
    
    // Fetch P&L using the XeroReportFetcher
    console.log('Calling XeroReportFetcher.fetchProfitLossSummary...');
    const plSummary = await XeroReportFetcher.fetchProfitLossSummary(
      tenantId,
      startDate,
      endDate
    );
    
    console.log('\n=== P&L SUMMARY RESULTS ===');
    console.log(JSON.stringify(plSummary, null, 2));
    
    // Also fetch raw report directly to compare
    console.log('\n\nFetching raw P&L report directly from Xero API...');
    const { executeXeroAPICall } = require('../lib/xero-helpers');
    
    const rawResponse = await executeXeroAPICall(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportProfitAndLoss(
        tenantId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        false
      )
    );
    
    const report = rawResponse?.body?.reports?.[0] || rawResponse?.reports?.[0];
    
    if (report) {
      // Save full report to file for analysis
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `pl-raw-report-${timestamp}.json`;
      const filepath = path.join(process.cwd(), filename);
      
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\nRaw report saved to: ${filename}`);
      
      // Log report structure
      console.log('\n=== REPORT STRUCTURE ===');
      console.log(`Report Name: ${report.reportName}`);
      console.log(`Report Title: ${report.reportTitle}`);
      console.log(`Report Date: ${report.reportDate}`);
      console.log(`Number of sections: ${report.rows?.length || 0}`);
      
      if (report.rows) {
        console.log('\n=== SECTIONS ===');
        report.rows.forEach((section, index) => {
          console.log(`\nSection ${index}:`);
          console.log(`  Type: ${section.rowType}`);
          console.log(`  Title: ${section.title || 'N/A'}`);
          console.log(`  Rows: ${section.rows?.length || 0}`);
          
          if (section.rows && section.rows.length > 0) {
            console.log('  Sample rows:');
            section.rows.slice(0, 3).forEach((row, rowIndex) => {
              if (row.cells) {
                const cells = row.cells.map(c => c?.value || '').join(' | ');
                console.log(`    Row ${rowIndex}: ${cells}`);
              }
            });
          }
        });
      }
    } else {
      console.log('\nNo report data found in response');
    }
    
    // Check development.log for detailed parsing info
    console.log('\n\nCheck development.log for detailed parsing information.');
    
  } catch (error) {
    console.error('\nError during P&L parsing test:', error);
    console.error('\nStack trace:', error.stack);
  }
}

// Run the test
testPLParsing().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(error => {
  console.error('\nTest failed:', error);
  process.exit(1);
});