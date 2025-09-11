#!/usr/bin/env node
const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

// Import the necessary modules
const { getXeroClient } = require('../lib/xero-client');
const { getTenantId } = require('../lib/xero-helpers');
const { executeXeroAPICall } = require('../lib/xero-api-wrapper');

async function testXeroDirectAPI() {
  console.log('Testing direct Xero API call for P&L report...\n');
  
  try {
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      throw new Error('Failed to get Xero client');
    }
    
    // Get tenant ID
    const mockRequest = { headers: new Map() };
    const tenantId = await getTenantId(mockRequest);
    console.log('Tenant ID:', tenantId);
    
    // Test different date ranges
    const testCases = [
      { from: '2025-05-01', to: '2025-05-31', label: 'May 2025' },
      { from: '2025-04-01', to: '2025-04-30', label: 'April 2025' },
      { from: '2025-01-01', to: '2025-05-31', label: 'Jan-May 2025' },
      { from: '2024-05-01', to: '2024-05-31', label: 'May 2024' },
    ];
    
    for (const testCase of testCases) {
      console.log(`\n=== Testing ${testCase.label} (${testCase.from} to ${testCase.to}) ===`);
      
      try {
        const response = await executeXeroAPICall(
          xeroClient,
          tenantId,
          (client) => client.accountingApi.getReportProfitAndLoss(
            tenantId,
            testCase.from,
            testCase.to,
            undefined, // periods
            undefined, // timeframe
            undefined, // trackingCategoryID
            undefined, // trackingCategoryID2
            undefined, // trackingOptionID
            undefined, // trackingOptionID2
            true, // standardLayout
            false // paymentsOnly
          )
        );
        
        const report = response?.body?.reports?.[0] || response?.reports?.[0];
        
        if (!report || !report.rows) {
          console.log('No data returned');
          continue;
        }
        
        console.log('Report Name:', report.reportName);
        console.log('Report Date:', report.reportDate);
        console.log('Report Title:', report.reportTitle);
        
        // Count sections and accounts
        let revenueAccounts = 0;
        let expenseAccounts = 0;
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        report.rows.forEach((section) => {
          if (section.rowType === 'Section' && section.rows) {
            const sectionTitle = section.title || '';
            console.log(`\nSection: "${sectionTitle}" (${section.rows.length} rows)`);
            
            // Show first few accounts in each section
            section.rows.slice(0, 3).forEach((row) => {
              if (row.cells && row.cells.length >= 2) {
                const accountName = row.cells[0]?.value || '';
                const value = row.cells[1]?.value || '0';
                if (accountName && !accountName.toLowerCase().includes('total')) {
                  console.log(`  - ${accountName}: ${value}`);
                  
                  // Count accounts
                  if (sectionTitle.toLowerCase().includes('income') || 
                      sectionTitle.toLowerCase().includes('revenue')) {
                    revenueAccounts++;
                  } else if (sectionTitle.toLowerCase().includes('expense')) {
                    expenseAccounts++;
                  }
                }
              }
            });
            
            // Look for totals
            section.rows.forEach((row) => {
              if (row.cells && row.cells.length >= 2) {
                const label = row.cells[0]?.value || '';
                const value = parseFloat(row.cells[1]?.value?.toString().replace(/[^0-9.-]/g, '') || '0');
                
                if (label.toLowerCase().includes('total')) {
                  if (sectionTitle.toLowerCase().includes('income') || 
                      sectionTitle.toLowerCase().includes('revenue')) {
                    totalRevenue += Math.abs(value);
                  } else if (sectionTitle.toLowerCase().includes('expense')) {
                    totalExpenses += Math.abs(value);
                  }
                }
              }
            });
          }
        });
        
        console.log(`\nSummary:`);
        console.log(`- Revenue accounts: ${revenueAccounts}`);
        console.log(`- Expense accounts: ${expenseAccounts}`);
        console.log(`- Total Revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`- Total Expenses: $${totalExpenses.toFixed(2)}`);
        
      } catch (error) {
        console.error(`Error for ${testCase.label}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testXeroDirectAPI();