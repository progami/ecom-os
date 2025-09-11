#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { XeroReportFetcher } from '../lib/xero-report-fetcher';
import { structuredLogger } from '../lib/logger';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testXeroApiDirectly() {
  console.log('=== TESTING XERO API DIRECTLY ===\n');
  
  try {
    // Get the user with Xero credentials
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null },
        xeroAccessToken: { not: null }
      }
    });

    if (!user || !user.tenantId) {
      console.log('❌ No user with Xero credentials found');
      return;
    }

    console.log('✓ Found user with Xero tenant ID:', user.tenantId);

    // Test May 31, 2025
    console.log('\n=== FETCHING MAY 31, 2025 DATA ===');
    const mayDate = new Date('2025-05-31');
    const mayData = await XeroReportFetcher.fetchBalanceSheetSummary(user.tenantId, mayDate);
    
    console.log('API Results (May 31, 2025):');
    console.log('- Total Assets:', mayData.totalAssets);
    console.log('- Total Liabilities:', mayData.totalLiabilities);
    console.log('- Net Assets:', mayData.netAssets);
    console.log('- Cash:', mayData.cash);
    console.log('- Current Assets:', mayData.currentAssets);
    console.log('- Current Liabilities:', mayData.currentLiabilities);

    // Test June 30, 2025
    console.log('\n\n=== FETCHING JUNE 30, 2025 DATA ===');
    const juneDate = new Date('2025-06-30');
    const juneData = await XeroReportFetcher.fetchBalanceSheetSummary(user.tenantId, juneDate);
    
    console.log('API Results (June 30, 2025):');
    console.log('- Total Assets:', juneData.totalAssets);
    console.log('- Total Liabilities:', juneData.totalLiabilities);
    console.log('- Net Assets:', juneData.netAssets);
    console.log('- Cash:', juneData.cash);
    console.log('- Current Assets:', juneData.currentAssets);
    console.log('- Current Liabilities:', juneData.currentLiabilities);

    // Compare with Excel values
    console.log('\n\n=== COMPARISON WITH EXCEL VALUES ===');
    
    console.log('\nMAY 31, 2025:');
    console.log('                    API Value      Excel Value     Difference');
    console.log('--------------------------------------------------------------');
    const mayExcel = {
      totalAssets: 262012.02,
      totalLiabilities: 68131.02,
      cash: 179272.78
    };
    
    Object.entries(mayExcel).forEach(([key, excelVal]) => {
      const apiVal = mayData[key] || 0;
      const diff = apiVal - excelVal;
      const status = Math.abs(diff) < 0.01 ? '✅' : '❌';
      console.log(
        `${key.padEnd(20)} £${apiVal.toFixed(2).padStart(12)}  £${excelVal.toFixed(2).padStart(12)}  £${diff.toFixed(2).padStart(10)} ${status}`
      );
    });

    console.log('\nJUNE 30, 2025:');
    console.log('                    API Value      Excel Value     Difference');
    console.log('--------------------------------------------------------------');
    const juneExcel = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      cash: 155545.12
    };
    
    Object.entries(juneExcel).forEach(([key, excelVal]) => {
      const apiVal = juneData[key] || 0;
      const diff = apiVal - excelVal;
      const status = Math.abs(diff) < 0.01 ? '✅' : '❌';
      console.log(
        `${key.padEnd(20)} £${apiVal.toFixed(2).padStart(12)}  £${excelVal.toFixed(2).padStart(12)}  £${diff.toFixed(2).padStart(10)} ${status}`
      );
    });

  } catch (error) {
    console.error('Error:', error);
    structuredLogger.error('[TestXeroAPI] Failed', error);
  } finally {
    await prisma.$disconnect();
  }
}

testXeroApiDirectly();