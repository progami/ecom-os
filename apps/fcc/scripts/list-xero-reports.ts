#!/usr/bin/env ts-node

import { getXeroClient } from '../lib/xero-client';
import { getTenantId } from '../lib/xero-helpers';
import { structuredLogger } from '../lib/logger';

async function listXeroReports() {
  try {
    console.log('=== Listing Available Xero Reports ===\n');
    
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      throw new Error('Failed to get Xero client');
    }

    // Get tenant ID from request context (you'll need to adjust this)
    const tenantId = process.env.XERO_TENANT_ID || '';
    
    if (!tenantId) {
      console.error('Please set XERO_TENANT_ID environment variable');
      process.exit(1);
    }

    // Try to get reports list
    try {
      const response = await xeroClient.accountingApi.getReportsList(tenantId);
      console.log('Available Reports:');
      console.log(JSON.stringify(response.body, null, 2));
    } catch (error: any) {
      console.error('Error fetching reports list:', error.message);
    }

    // Try Bank Summary
    console.log('\n=== Testing Bank Summary Report ===');
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1);
      
      const bankSummary = await xeroClient.accountingApi.getReportBankSummary(
        tenantId,
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );
      
      console.log('Bank Summary Report Structure:');
      const report = bankSummary.body?.reports?.[0];
      if (report) {
        console.log('Report Name:', report.reportName);
        console.log('Report Title:', report.reportTitle);
        console.log('Sections:', report.rows?.map((r: any) => ({
          type: r.rowType,
          title: r.title,
          rowCount: r.rows?.length
        })));
        
        // Log first few rows of each section
        report.rows?.forEach((section: any) => {
          if (section.rows && section.rows.length > 0) {
            console.log(`\n${section.title} - First Row:`, section.rows[0]);
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching bank summary:', error.message);
    }

    // Try Executive Summary with detail
    console.log('\n=== Testing Executive Summary Report (Detailed) ===');
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1);
      
      const execSummary = await xeroClient.accountingApi.getReportExecutiveSummary(
        tenantId,
        toDate.toISOString().split('T')[0]
      );
      
      console.log('Executive Summary Report Structure:');
      const report = execSummary.body?.reports?.[0];
      if (report) {
        console.log('Report Name:', report.reportName);
        console.log('Report Title:', report.reportTitle);
        console.log('Sections:', report.rows?.map((r: any) => ({
          type: r.rowType,
          title: r.title,
          rowCount: r.rows?.length
        })));
        
        // Look for cash-related sections
        report.rows?.forEach((section: any) => {
          if (section.title && section.title.toLowerCase().includes('cash')) {
            console.log(`\nCash Section Found: ${section.title}`);
            section.rows?.forEach((row: any) => {
              console.log('  Row:', row.cells?.map((c: any) => c.value).join(' | '));
            });
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching executive summary:', error.message);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  listXeroReports()
    .then(() => {
      console.log('\n=== Done ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}