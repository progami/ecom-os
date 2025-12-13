import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

// Updated session cookies
const cookies = [
  'next-auth=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GOPudA32apQ4_9Wy.IWS7cUFGc3JOH027cSdfe2in05XEn7HlbKPkNajUXZzMGO9Eq6f1B4yAmeN9CWtQJ1kQLFtarD-pNP5vR0ZBoWTUUG1KAaitTjhnvndD1UAn2-jXfgEIdq_N1efIEVOWmzKPsnkfos4emhC5jP2sKipUXotTApZkNvVpcEVoxR65tfoa4WId5tr35A-U2Oy-HNEyh7UdeAiJFEl0okQu-Y8vSYkZ9_ic15n4LCSjP420PV1WGI9MESu5FBuUdvIGHHl9TAVfK1fMDCW8z_LGkU_3wf3iAGapgRC5bhuiSGhHkbT7M1kBrbtl12LUk7va7wT2zCWdDsHEaoVX-mqlJ_TqCbD5vtU4psnkOcFzxG9vkV7w-D-Y4coVupfMuwQs1_wjww72.kfVbKrULtlADr-nTMOa0yA',
  'user_session=%7B%22user%22%3A%7B%22id%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22Jarrar%20Amjad%22%7D%2C%22userId%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22ca9f2956-55ce-47de-8e9f-b1f74c26098f%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D',
  'xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0MTYzNTAsImV4cCI6MTc1MTQxODE1MCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQxNjM0MSwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6IjMxOGM3ZWM0NzNkZjQwMTE5NjU5N2JlZDgwZTAzNTE5Iiwic2lkIjoiMzE4YzdlYzQ3M2RmNDAxMTk2NTk3YmVkODBlMDM1MTkiLCJqdGkiOiI4QThGN0Y3OTcyNUMyOTNCMEE4QzZCOUVBNkJGMzNGMiIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiM2FhOWM5NTMtODAxMS00MmQ5LTk5OTMtMjU1MGUwNTRmMjE2Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.dp7oKPJ9qld_rp3eVDsUbwbj2JvhlTLfEENAiY6p965bkI6nxeV6uIcuCpqhFnl2VeeG0uCI_PxWvrsF9h2kMeocfASlcOdgW-cnIrnUHZLw_NKA_VjvFpgyLX3jS2TGY0ciNdPKhStxmaDynD7Qa95jC4b-WHuaY-R29GEEerHACI_l8y385f4p5r1abyVUMuK5sHFZKutSoWQ58xJzO8lronYuj1EKCDLp4nEps7iQNaYM5dsTs3zmnznxF39flwXiVRy2F7-fsc8KjIA4Zn3rfRoHARolTFe0gxszXELxXISsiP5nO03y3QJePyN9sonVGbCWXpKFaY24a5a_CQ%22%2C%22refresh_token%22%3A%220-vJkSilBnAC43Fsq766VnRGe5m3ezkW3UtorEA8LS8%22%2C%22expires_at%22%3A1751418150%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'
].join('; ');

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