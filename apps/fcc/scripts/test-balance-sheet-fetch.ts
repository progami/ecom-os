import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE'
const cookie = process.env[AUTH_COOKIE_ENV]

if (!cookie) {
  throw new Error(`Missing authentication cookie. Set ${AUTH_COOKIE_ENV} with a valid central session cookie string (include NextAuth + Xero tokens).`)
}

async function testBalanceSheetFetch() {
  console.log('=== TESTING BALANCE SHEET FETCH ===\n');
  
  try {
    // Test with a recent date
    const testDate = '2024-11-30';
    console.log(`📊 Testing Balance Sheet fetch for ${testDate}...\n`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${testDate}&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      // @ts-ignore
      agent
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      return;
    }
    
    if (response.ok) {
      console.log('\n✅ Success! Balance Sheet data:');
      console.log(`  Total Assets: £${responseData.totalAssets?.toFixed(2) || 0}`);
      console.log(`  Total Liabilities: £${responseData.totalLiabilities?.toFixed(2) || 0}`);
      console.log(`  Net Assets: £${responseData.netAssets?.toFixed(2) || 0}`);
      
      // Check if it was stored in database
      const stored = await prisma.reportData.findFirst({
        where: {
          reportType: 'BALANCE_SHEET',
          periodEnd: new Date(testDate)
        },
        orderBy: {
          version: 'desc'
        }
      });
      
      if (stored) {
        console.log(`\n✅ Data stored in database with version ${stored.version}`);
      }
    } else {
      console.log('\n❌ Error response:', responseData);
      
      // Check if error was stored
      const errorStored = await prisma.importedReport.findFirst({
        where: {
          type: 'BALANCE_SHEET',
          status: 'FAILED',
          periodEnd: new Date(testDate)
        },
        orderBy: {
          importedAt: 'desc'
        }
      });
      
      if (errorStored) {
        console.log('\n📝 Error details stored in ImportedReport:');
        console.log(`  Error: ${errorStored.errorLog}`);
        if (errorStored.rawData) {
          const rawData = JSON.parse(errorStored.rawData);
          console.log(`  Raw Data:`, JSON.stringify(rawData, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBalanceSheetFetch();