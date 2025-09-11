#!/usr/bin/env ts-node

import { XeroAccountingApi } from 'xero-node';
import { getXeroClient } from '../lib/xero-client';
import { getTenantId } from '../lib/xero-helpers';
import { promises as fs } from 'fs';
import path from 'path';

async function testXeroCashFlowStatement() {
  try {
    console.log('=== Fetching Xero Cash Flow Statement ===\n');

    // Get Xero client
    const xeroClient = await getXeroClient();
    const accountingApi = new XeroAccountingApi(xeroClient);
    
    // Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
      throw new Error('No tenant ID found');
    }

    // Test different date ranges
    const testCases = [
      {
        name: 'Current Year to Date (Jun 1 - May 31)',
        fromDate: '2024-06-01',
        toDate: '2025-05-31'
      },
      {
        name: 'Last Complete Year',
        fromDate: '2023-06-01',
        toDate: '2024-05-31'
      },
      {
        name: 'Current Month',
        fromDate: '2025-07-01',
        toDate: '2025-07-31'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\nFetching: ${testCase.name}`);
      console.log(`Period: ${testCase.fromDate} to ${testCase.toDate}`);

      try {
        // Fetch the Statement of Cash Flows
        const response = await accountingApi.getReportCashflowStatement(
          tenantId,
          testCase.fromDate,
          testCase.toDate
        );

        if (response.body && response.body.reports && response.body.reports.length > 0) {
          const report = response.body.reports[0];
          
          console.log('\nReport Structure:');
          console.log(`- Report Name: ${report.reportName}`);
          console.log(`- Report Type: ${report.reportType}`);
          console.log(`- Report Titles: ${report.reportTitles?.join(', ')}`);
          console.log(`- Number of Rows: ${report.rows?.length || 0}`);

          // Save the full report
          const fileName = `cash-flow-statement-${testCase.fromDate}-to-${testCase.toDate}.json`;
          const filePath = path.join(process.cwd(), 'data', 'test-reports', fileName);
          
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, JSON.stringify(report, null, 2));
          
          console.log(`✓ Saved to: ${fileName}`);

          // Extract key sections
          if (report.rows) {
            console.log('\nReport Sections:');
            
            report.rows.forEach((row: any) => {
              if (row.rowType === 'Section' && row.title) {
                console.log(`\n${row.title}:`);
                
                if (row.rows) {
                  row.rows.forEach((subRow: any) => {
                    if (subRow.rowType === 'Row' && subRow.cells) {
                      const label = subRow.cells[0]?.value || 'Unknown';
                      const amount = subRow.cells[1]?.value || '0';
                      console.log(`  ${label}: ${amount}`);
                    }
                  });
                }
              }
            });
          }
        }
      } catch (error: any) {
        console.error(`✗ Error fetching ${testCase.name}:`, error.message);
      }
    }

    console.log('\n=== Comparison with Bank Summary ===');
    console.log('The Cash Flow Statement shows:');
    console.log('- Operating Activities (revenue, expenses, working capital changes)');
    console.log('- Investing Activities (asset purchases/sales)');
    console.log('- Financing Activities (loans, equity changes)');
    console.log('\nThe Bank Summary shows:');
    console.log('- Individual bank account movements');
    console.log('- Cash received and spent per account');
    console.log('- Foreign exchange gains/losses');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
if (require.main === module) {
  testXeroCashFlowStatement()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}