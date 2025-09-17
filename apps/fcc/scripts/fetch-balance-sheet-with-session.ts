import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';
import * as fs from 'fs';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

// Get cookie string from environment or command line
const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE';
const cookieString = process.env[AUTH_COOKIE_ENV] || process.argv[2];

if (!cookieString) {
  console.error('❌ Error: Provide a central session cookie via FCC_AUTH_COOKIE env variable or as the first argument.');
  console.error('Usage: npm run tsx scripts/fetch-balance-sheet-with-session.ts "next-auth.session-token=...; xero_token=..."');
  process.exit(1);
}

interface FetchResult {
  success: boolean;
  data?: any;
  error?: string;
  errorDetails?: any;
  httpStatus?: number;
}

async function fetchBalanceSheetData(date: string, description: string): Promise<FetchResult> {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${date}&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieString
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
        httpStatus: response.status
      };
    }
    
    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
      
      // Log detailed error to development.log
      structuredLogger.error('[Balance Sheet Fetch] API Error', {
        date,
        httpStatus: response.status,
        error: responseData.error,
        details: responseData
      });
      
      // Store error in ImportedReport
      try {
        await prisma.importedReport.create({
          data: {
            type: 'BALANCE_SHEET',
            source: 'API',
            periodStart: new Date(date.split('-')[0], 0, 1),
            periodEnd: new Date(date),
            importedBy: 'SessionFetchScript',
            status: 'FAILED',
            recordCount: 0,
            errorLog: responseData.error || `HTTP ${response.status}`,
            rawData: JSON.stringify(responseData),
            metadata: JSON.stringify({
              fetchDate: new Date().toISOString(),
              scriptName: 'fetch-balance-sheet-with-session.ts',
              httpStatus: response.status
            })
          }
        });
      } catch (dbError) {
        console.error(`   ⚠️  Failed to store error in database: ${dbError}`);
      }
      
      return { 
        success: false, 
        error: responseData.error || `HTTP ${response.status}`,
        errorDetails: responseData,
        httpStatus: response.status
      };
    }
    
    console.log(`   ✅ Total Assets: £${responseData.totalAssets?.toFixed(2) || 0}, Net Assets: £${responseData.netAssets?.toFixed(2) || 0}`);
    
    // Log success to development.log
    structuredLogger.info('[Balance Sheet Fetch] Success', {
      date,
      totalAssets: responseData.totalAssets,
      netAssets: responseData.netAssets,
      recordCount: responseData.sections?.reduce((count: number, section: any) => 
        count + (section.lineItems?.length || 0), 0) || 0
    });
    
    return { 
      success: true, 
      data: responseData
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed: ${errorMessage}`);
    
    // Log error to development.log
    structuredLogger.error('[Balance Sheet Fetch] Network Error', {
      date,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return { 
      success: false, 
      error: errorMessage,
      errorDetails: error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) }
    };
  }
}

async function fetchRecentMonths() {
  console.log('=== FETCHING RECENT BALANCE SHEET DATA ===\n');
    console.log(`Using session cookie: ${cookieString.substring(0, 20)}...`);
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  const results: any[] = [];
  
  // Fetch last 6 months of data
  console.log('\n📅 FETCHING LAST 6 MONTHS\n');
  
  for (let i = 0; i < 6; i++) {
    const targetDate = new Date(currentYear, currentMonth - 1 - i, 0);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const lastDay = targetDate.getDate();
    
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    const monthName = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const result = await fetchBalanceSheetData(dateStr, monthName);
    
    if (result.success) {
      successCount++;
      results.push({ date: dateStr, data: result.data });
    } else {
      failureCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
  
  // Log final summary to development.log
  structuredLogger.info('[Balance Sheet Fetch] Session completed', {
    successCount,
    failureCount,
    totalAttempts: successCount + failureCount,
    months: results.map(r => r.date)
  });
  
  return results;
}

// Add option to fetch all historical data
async function fetchAllHistorical() {
  console.log('=== FETCHING ALL HISTORICAL BALANCE SHEET DATA ===\n');
  
  const startYear = 2021;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} ---`);
    
    const maxMonth = (year === currentYear) ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      const result = await fetchBalanceSheetData(dateStr, `${monthName} ${year}`);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
}

// Main execution
const mode = process.argv[3] || 'recent';

async function main() {
  try {
    if (mode === 'all') {
      await fetchAllHistorical();
    } else {
      await fetchRecentMonths();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    structuredLogger.error('[Balance Sheet Fetch] Fatal error', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
