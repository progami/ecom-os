#!/usr/bin/env ts-node

import { getXeroClient } from '../lib/xero-client';
import { structuredLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import fs from 'fs';

async function testBankSummaryReport() {
  try {
    console.log('=== Testing Bank Summary Report ===\n');
    
    // Get tenant ID from the first user with Xero connection
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null }
      }
    });

    if (!user || !user.tenantId) {
      throw new Error('No user with Xero connection found');
    }

    const tenantId = user.tenantId;
    console.log(`Using tenant ID: ${tenantId}`);
    console.log(`Tenant Name: ${user.tenantName}\n`);
    
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      throw new Error('Failed to get Xero client');
    }

    // Test different date ranges
    const testCases = [
      {
        name: 'Current Month',
        fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        toDate: new Date()
      },
      {
        name: 'Last Month',
        fromDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        toDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0)
      },
      {
        name: 'July 2024',
        fromDate: new Date(2024, 6, 1),
        toDate: new Date(2024, 6, 31)
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n=== ${testCase.name} ===`);
      console.log(`From: ${testCase.fromDate.toISOString().split('T')[0]}`);
      console.log(`To: ${testCase.toDate.toISOString().split('T')[0]}`);
      
      try {
        const response = await xeroClient.accountingApi.getReportBankSummary(
          tenantId,
          testCase.fromDate.toISOString().split('T')[0],
          testCase.toDate.toISOString().split('T')[0]
        );
        
        const report = response.body?.reports?.[0];
        
        if (report) {
          console.log('\nReport Structure:');
          console.log('- Report Name:', report.reportName);
          console.log('- Report Title:', report.reportTitle);
          console.log('- Report Date:', report.reportDate);
          console.log('- Report Type:', report.reportType);
          
          console.log('\nSections:');
          report.rows?.forEach((section: any, idx: number) => {
            console.log(`${idx + 1}. ${section.title || 'Untitled'} (${section.rowType})`);
            if (section.rows) {
              console.log(`   - Row count: ${section.rows.length}`);
              
              // Show column headers if available
              const headerRow = section.rows.find((r: any) => r.rowType === 'Header');
              if (headerRow && headerRow.cells) {
                console.log('   - Columns:', headerRow.cells.map((c: any) => c.value).join(' | '));
              }
              
              // Show first few data rows
              const dataRows = section.rows.filter((r: any) => r.rowType === 'Row');
              dataRows.slice(0, 3).forEach((row: any, rowIdx: number) => {
                if (row.cells) {
                  console.log(`   - Row ${rowIdx + 1}:`, row.cells.map((c: any) => c.value || '').join(' | '));
                }
              });
              
              if (dataRows.length > 3) {
                console.log(`   - ... and ${dataRows.length - 3} more rows`);
              }
            }
          });
          
          // Save full report for analysis
          const fileName = `bank-summary-${testCase.name.replace(/\s+/g, '-').toLowerCase()}.json`;
          fs.writeFileSync(fileName, JSON.stringify(report, null, 2));
          console.log(`\nFull report saved to: ${fileName}`);
        } else {
          console.log('No report data found');
        }
        
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        if (error.response?.body) {
          console.error('Response:', JSON.stringify(error.response.body, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  testBankSummaryReport()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}