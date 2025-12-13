import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

// Updated session cookies - January 2025
const cookies = [
  'next-auth=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GOPudA32apQ4_9Wy.IWS7cUFGc3JOH027cSdfe2in05XEn7HlbKPkNajUXZzMGO9Eq6f1B4yAmeN9CWtQJ1kQLFtarD-pNP5vR0ZBoWTUUG1KAaitTjhnvndD1UAn2-jXfgEIdq_N1efIEVOWmzKPsnkfos4emhC5jP2sKipUXotTApZkNvVpcEVoxR65tfoa4WId5tr35A-U2Oy-HNEyh7UdeAiJFEl0okQu-Y8vSYkZ9_ic15n4LCSjP420PV1WGI9MESu5FBuUdvIGHHl9TAVfK1fMDCW8z_LGkU_3wf3iAGapgRC5bhuiSGhHkbT7M1kBrbtl12LUk7va7wT2zCWdDsHEaoVX-mqlJ_TqCbD5vtU4psnkOcFzxG9vkV7w-D-Y4coVupfMuwQs1_wjww72.kfVbKrULtlADr-nTMOa0yA',
  'user_session=%7B%22user%22%3A%7B%22id%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22Jarrar%20Amjad%22%7D%2C%22userId%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22ca9f2956-55ce-47de-8e9f-b1f74c26098f%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D',
  'xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTEzODIzNTAsImV4cCI6MTc1MTM4NDE1MCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTM4MjM0NiwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6IjA1OTViNTRjZTkxMDRjY2I4ZDM1YWJkMzA1MmEwNGY3Iiwic2lkIjoiMDU5NWI1NGNlOTEwNGNjYjhkMzVhYmQzMDUyYTA0ZjciLCJqdGkiOiI5MkUyODE1Rjk5RjhBMEMxMUM3OEJCQ0I3OEQxRkNFNyIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiMDdmYzUwMzYtYjE1YS00ZWJlLWEwNTUtYWI3N2IxNTIwMTg2Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJsZWdhY3kiXX0.DMo8thBEYlst0fH6KuWEq2k20nWPG_vLC7oMX73bPGYCpKESOp-w0ONJ1typdoUQE1B2nWbrE7hceUm51x_91s9AQBfngvOqIQowNrl8SrTElM_VPh7rl08wYY9U1ujXUS6a6mWFfTLQutu6FhaWoGjl3NgFXkufXoNkOLdRht9Wb_payHUhjGNeMAlD7MygBmgk6rXT6yPWPxN9H0dlBu29Cx5uk1L11yrJv0XAK7Xg-r3KI17JRwnDqKlicmYFAOl3i4ghzo-YW1hl33kPCAvT3PMelA-ihVAfZUz65ObOp-ZgCGl4mWKLQSQsIO418pw8SI-yEBVkiS3SFy-VIA%22%2C%22refresh_token%22%3A%220o8CRJICj9M-yx-5wgE51H20pf4vCT4MTluMte_wIZ8%22%2C%22expires_at%22%3A1751384150%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'
].join('; ');

interface FetchResult {
  success: boolean;
  data?: any;
  error?: string;
  errorDetails?: any;
  httpStatus?: number;
  rawResponse?: string;
}

async function fetchBalanceSheetData(date: string, description: string): Promise<FetchResult> {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${date}&refresh=true`;
    
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
      console.error(`   ❌ Failed to parse response: ${responseText.substring(0, 200)}...`);
      return { 
        success: false, 
        error: 'Invalid JSON response', 
        errorDetails: { parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' },
        httpStatus: response.status,
        rawResponse: responseText
      };
    }
    
    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
      
      // Store detailed error information
      const errorResult: FetchResult = {
        success: false,
        error: responseData.error || `HTTP ${response.status}`,
        errorDetails: {
          message: responseData.message,
          recommendation: responseData.recommendation,
          httpStatus: response.status,
          statusText: response.statusText,
          fullResponse: responseData
        },
        httpStatus: response.status,
        rawResponse: responseText
      };
      
      // Create failed ImportedReport entry with detailed error info
      try {
        await prisma.importedReport.create({
          data: {
            type: 'BALANCE_SHEET',
            source: 'API',
            periodStart: new Date(date.split('-')[0], 0, 1), // Jan 1 of the year
            periodEnd: new Date(date),
            importedBy: 'HistoricalFetchScript',
            status: 'FAILED',
            recordCount: 0,
            errorLog: errorResult.error,
            rawData: JSON.stringify(errorResult.errorDetails), // Store full error details
            metadata: JSON.stringify({
              fetchDate: new Date().toISOString(),
              scriptName: 'fetch-all-historical-balance-sheets.ts',
              httpStatus: response.status,
              errorDetails: errorResult.errorDetails
            })
          }
        });
        console.log(`   📝 Stored failed fetch details in ImportedReport`);
      } catch (dbError) {
        console.error(`   ⚠️  Failed to store error in database: ${dbError}`);
      }
      
      return errorResult;
    }
    
    if (responseData.error) {
      console.error(`   ❌ API Error: ${responseData.error}`);
      return { 
        success: false, 
        error: responseData.error,
        errorDetails: responseData,
        rawResponse: responseText
      };
    }
    
    console.log(`   ✅ Total Assets: £${responseData.totalAssets?.toFixed(2) || 0}, Net Assets: £${responseData.netAssets?.toFixed(2) || 0}`);
    return { 
      success: true, 
      data: responseData,
      rawResponse: responseText
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed: ${errorMessage}`);
    
    // Store network/system errors
    try {
      await prisma.importedReport.create({
        data: {
          type: 'BALANCE_SHEET',
          source: 'API',
          periodStart: new Date(date.split('-')[0], 0, 1),
          periodEnd: new Date(date),
          importedBy: 'HistoricalFetchScript',
          status: 'FAILED',
          recordCount: 0,
          errorLog: errorMessage,
          rawData: JSON.stringify({
            errorType: 'NETWORK_ERROR',
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : String(error)
          }),
          metadata: JSON.stringify({
            fetchDate: new Date().toISOString(),
            scriptName: 'fetch-all-historical-balance-sheets.ts',
            errorType: 'network_or_system_error'
          })
        }
      });
    } catch (dbError) {
      console.error(`   ⚠️  Failed to store network error in database: ${dbError}`);
    }
    
    return { 
      success: false, 
      error: errorMessage,
      errorDetails: error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) }
    };
  }
}

async function clearExistingData(date: Date) {
  try {
    // For Balance Sheet, the period is always Jan 1 to the specified date
    const periodStart = new Date(date.getFullYear(), 0, 1);
    const periodEnd = date;
    
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'BALANCE_SHEET',
        periodStart: periodStart,
        periodEnd: periodEnd
      }
    });
    
    if (deleted.count > 0) {
      console.log(`   🧹 Cleared ${deleted.count} existing entries`);
    }
  } catch (error) {
    console.error(`   ⚠️  Error clearing data: ${error}`);
  }
}

async function fetchAllHistoricalBalanceSheets() {
  console.log('=== FETCHING ALL HISTORICAL BALANCE SHEET DATA ===\n');
  console.log('This will fetch monthly and quarterly balance sheets from January 2021 to present.\n');
  
  const startYear = 2021;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  const failureDetails: { date: string; error: string; details?: any }[] = [];
  
  // 1. Fetch all monthly balance sheets (end of each month)
  console.log('📅 FETCHING MONTHLY BALANCE SHEETS\n');
  
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} ---`);
    
    const maxMonth = (year === currentYear) ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      // Clear existing data for this period
      await clearExistingData(new Date(year, month, 0));
      
      const result = await fetchBalanceSheetData(dateStr, `${monthName} ${year} Balance Sheet`);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        failureDetails.push({
          date: dateStr,
          error: result.error || 'Unknown error',
          details: result.errorDetails
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // 2. Fetch quarterly balance sheets (for redundancy and common reporting periods)
  console.log('\n\n📊 FETCHING QUARTERLY BALANCE SHEETS\n');
  
  const quarters = [
    { month: 3, name: 'Q1' },
    { month: 6, name: 'Q2' },
    { month: 9, name: 'Q3' },
    { month: 12, name: 'Q4' }
  ];
  
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} Quarters ---`);
    
    for (const quarter of quarters) {
      // Skip future quarters
      if (year === currentYear && quarter.month > currentMonth) {
        continue;
      }
      
      const lastDay = new Date(year, quarter.month, 0).getDate();
      const dateStr = `${year}-${quarter.month.toString().padStart(2, '0')}-${lastDay}`;
      
      // Note: This might create duplicates with monthly fetches, but versioning will handle it
      const result = await fetchBalanceSheetData(dateStr, `${quarter.name} ${year} Balance Sheet`);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        // Don't add to failure details if it's a duplicate
        if (!failureDetails.some(f => f.date === dateStr)) {
          failureDetails.push({
            date: dateStr,
            error: result.error || 'Unknown error',
            details: result.errorDetails
          });
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 3. Fetch year-end balance sheets
  console.log('\n\n📊 FETCHING YEAR-END BALANCE SHEETS\n');
  
  for (let year = startYear; year <= currentYear - 1; year++) {
    const dateStr = `${year}-12-31`;
    
    const result = await fetchBalanceSheetData(dateStr, `Year-End ${year} Balance Sheet`);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
      // Don't add if already in failure list
      if (!failureDetails.some(f => f.date === dateStr)) {
        failureDetails.push({
          date: dateStr,
          error: result.error || 'Unknown error',
          details: result.errorDetails
        });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
  
  if (failureDetails.length > 0) {
    console.log('\n=== FAILURE DETAILS ===');
    failureDetails.forEach(failure => {
      console.log(`\n❌ ${failure.date}: ${failure.error}`);
      if (failure.details) {
        console.log(`   Details: ${JSON.stringify(failure.details, null, 2)}`);
      }
    });
  }
  
  // Log to development.log
  structuredLogger.info('[Historical Balance Sheet Fetch] Completed', {
    successCount,
    failureCount,
    totalAttempts: successCount + failureCount,
    dateRange: `${startYear}-01 to ${currentYear}-${currentMonth.toString().padStart(2, '0')}`,
    failureDetails: failureDetails.length > 0 ? failureDetails : undefined
  });
}

// Run the historical data fetch
fetchAllHistoricalBalanceSheets()
  .catch(error => {
    console.error('Fatal error:', error);
    structuredLogger.error('[Historical Balance Sheet Fetch] Fatal error', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });