const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const https = require('https');
const { structuredLogger } = require('../lib/logger');

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const cookie = 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y';

async function fetchBalanceSheetData(date, description) {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${date}&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      agent
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse response: ${responseText.substring(0, 200)}...`);
      return { 
        success: false, 
        error: 'Invalid JSON response', 
        errorDetails: { parseError: parseError.message || 'Unknown parse error' },
        httpStatus: response.status,
        rawResponse: responseText
      };
    }
    
    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
      
      // Store detailed error information
      const errorResult = {
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
              scriptName: 'fetch-all-historical-balance-sheets.js',
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
    const errorMessage = error.message || 'Unknown error';
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
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name
            }
          }),
          metadata: JSON.stringify({
            fetchDate: new Date().toISOString(),
            scriptName: 'fetch-all-historical-balance-sheets.js',
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
      errorDetails: { message: error.message, stack: error.stack }
    };
  }
}

async function clearExistingData(date) {
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
  const failureDetails = [];
  
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