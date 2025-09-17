import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE'
const cookies = process.env[AUTH_COOKIE_ENV]

if (!cookies) {
  throw new Error(`Missing authentication cookie. Set ${AUTH_COOKIE_ENV} with a valid central session cookie string (include NextAuth + Xero tokens).`)
}


async function testSingleMonth() {
  console.log('=== TESTING SINGLE MONTH CASH FLOW (January 2024) ===\n');
  
  try {
    const url = `https://localhost:3003/api/v1/xero/reports/cash-flow?month=1&year=2024&refresh=true`;
    
    console.log('📊 Fetching January 2024 Cash Flow...');
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookies
      },
      // @ts-ignore
      agent
    });
    
    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ Failed to parse response: ${responseText.substring(0, 200)}...`);
      return;
    }
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
      console.error('Full response:', JSON.stringify(responseData, null, 2));
      return;
    }
    
    console.log('\n✅ Cash Flow Data Retrieved:');
    console.log(JSON.stringify(responseData, null, 2));
    
    // Summarize the key data
    console.log('\n📊 Summary:');
    console.log(`   Source: ${responseData.source}`);
    console.log(`   Period: ${responseData.fromDate} to ${responseData.toDate}`);
    console.log(`   Opening Balance: £${responseData.summary?.openingBalance || 0}`);
    console.log(`   Operating Activities: £${responseData.operatingActivities?.netCashFromOperating || 0}`);
    console.log(`   Investing Activities: £${responseData.investingActivities?.netCashFromInvesting || 0}`);
    console.log(`   Financing Activities: £${responseData.financingActivities?.netCashFromFinancing || 0}`);
    console.log(`   Net Cash Flow: £${responseData.summary?.netCashFlow || 0}`);
    console.log(`   Closing Balance: £${responseData.summary?.closingBalance || 0}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSingleMonth()
  .then(() => console.log('\n✅ Test completed'))
  .catch(error => console.error('Test failed:', error));