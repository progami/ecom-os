#!/usr/bin/env ts-node

import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { getTenantId } from '../lib/xero-helpers';
import { format } from 'date-fns';

async function testCashFlowStatementAPI() {
  try {
    console.log('=== Testing Cash Flow Statement API ===\n');

    // Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID found');
    }

    // Test different date ranges
    const testCases = [
      {
        name: 'Last Month',
        fromDate: new Date('2025-06-01'),
        toDate: new Date('2025-06-30')
      },
      {
        name: 'Last Fiscal Year',
        fromDate: new Date('2023-06-01'),
        toDate: new Date('2024-05-31')
      },
      {
        name: 'Current Month',
        fromDate: new Date('2025-07-01'),
        toDate: new Date('2025-07-31')
      }
    ];

    for (const testCase of testCases) {
      console.log(`\nFetching: ${testCase.name}`);
      console.log(`Period: ${format(testCase.fromDate, 'MMM d, yyyy')} to ${format(testCase.toDate, 'MMM d, yyyy')}`);

      try {
        // Fetch the Cash Flow Statement
        const cashFlowData = await XeroReportFetcher.fetchCashFlowStatement(
          tenantId,
          testCase.fromDate,
          testCase.toDate
        );

        console.log('\n--- Cash Flow Statement Summary ---');
        console.log(`Report Name: ${cashFlowData.reportName}`);
        console.log(`Period: ${cashFlowData.fromDate} to ${cashFlowData.toDate}`);
        
        console.log('\nOperating Activities:');
        console.log(`  Receipts from Customers: ${cashFlowData.operatingActivities.receiptsFromCustomers || 0}`);
        console.log(`  Payments to Suppliers: ${cashFlowData.operatingActivities.paymentsToSuppliers || 0}`);
        console.log(`  Payments to Employees: ${cashFlowData.operatingActivities.paymentsToEmployees || 0}`);
        console.log(`  Interest Paid: ${cashFlowData.operatingActivities.interestPaid || 0}`);
        console.log(`  Income Tax Paid: ${cashFlowData.operatingActivities.incomeTaxPaid || 0}`);
        console.log(`  NET OPERATING: ${cashFlowData.operatingActivities.netCashFromOperating}`);
        
        console.log('\nInvesting Activities:');
        console.log(`  Purchase of Assets: ${cashFlowData.investingActivities.purchaseOfAssets || 0}`);
        console.log(`  Sale of Assets: ${cashFlowData.investingActivities.saleOfAssets || 0}`);
        console.log(`  NET INVESTING: ${cashFlowData.investingActivities.netCashFromInvesting}`);
        
        console.log('\nFinancing Activities:');
        console.log(`  Proceeds from Borrowing: ${cashFlowData.financingActivities.proceedsFromBorrowing || 0}`);
        console.log(`  Repayment of Borrowing: ${cashFlowData.financingActivities.repaymentOfBorrowing || 0}`);
        console.log(`  Dividends Paid: ${cashFlowData.financingActivities.dividendsPaid || 0}`);
        console.log(`  NET FINANCING: ${cashFlowData.financingActivities.netCashFromFinancing}`);
        
        console.log('\nSummary:');
        console.log(`  Opening Balance: ${cashFlowData.summary.openingBalance}`);
        console.log(`  Net Cash Flow: ${cashFlowData.summary.netCashFlow}`);
        console.log(`  Closing Balance: ${cashFlowData.summary.closingBalance}`);
        
        // Calculate the net cash flow manually to verify
        const calculatedNetFlow = 
          cashFlowData.operatingActivities.netCashFromOperating +
          cashFlowData.investingActivities.netCashFromInvesting +
          cashFlowData.financingActivities.netCashFromFinancing;
        
        console.log(`\nVerification:`);
        console.log(`  Calculated Net Flow: ${calculatedNetFlow}`);
        console.log(`  Reported Net Flow: ${cashFlowData.summary.netCashFlow}`);
        console.log(`  Match: ${Math.abs(calculatedNetFlow - cashFlowData.summary.netCashFlow) < 0.01 ? '✓' : '✗'}`);
        
      } catch (error: any) {
        console.error(`✗ Error fetching ${testCase.name}:`, error.message);
      }
    }

    console.log('\n=== Testing API Endpoint ===');
    
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/v1/xero/reports/cash-flow?month=6&year=2025', {
      headers: {
        'Content-Type': 'application/json',
        // Add any auth headers if needed
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('\nAPI Response Summary:');
      console.log(`  Source: ${data.source}`);
      console.log(`  Period: ${data.fromDate} to ${data.toDate}`);
      console.log(`  Has Operating Activities: ${!!data.operatingActivities}`);
      console.log(`  Has Investing Activities: ${!!data.investingActivities}`);
      console.log(`  Has Financing Activities: ${!!data.financingActivities}`);
      console.log(`  Net Cash Flow: ${data.summary?.netCashFlow || 0}`);
    } else {
      console.error('API request failed:', response.status, response.statusText);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
if (require.main === module) {
  testCashFlowStatementAPI()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}