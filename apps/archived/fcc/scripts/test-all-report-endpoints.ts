import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// HTTPS agent to handle self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Authentication cookie - same as fetch-all-historical-pl.ts
const cookie = 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y';

// Base URL for API requests
const BASE_URL = 'https://localhost:3003/api/v1/xero/reports';

// Test configuration
const TEST_DATE = '2024-10-31'; // Use October 2024 as test date
const YEAR_END_DATE = '2023-12-31'; // For year-end reports

// Report endpoints to test
const REPORT_ENDPOINTS = [
  {
    name: 'Profit & Loss',
    endpoint: 'profit-loss',
    params: {
      date: TEST_DATE,
      timeframe: 'MONTH',
      periods: '1'
    },
    expectedFields: ['totalRevenue', 'totalExpenses', 'netProfit', 'grossProfit']
  },
  {
    name: 'Balance Sheet',
    endpoint: 'balance-sheet',
    params: {
      date: TEST_DATE
    },
    expectedFields: ['totalAssets', 'totalLiabilities', 'netAssets', 'currentRatio']
  },
  {
    name: 'Cash Flow',
    endpoint: 'cash-flow',
    params: {
      date: TEST_DATE,
      timeframe: 'MONTH'
    },
    expectedFields: ['operatingActivities', 'investingActivities', 'financingActivities'] // netCashMovement might be optional
  },
  {
    name: 'Trial Balance',
    endpoint: 'trial-balance',
    params: {
      date: TEST_DATE
    },
    expectedFields: ['accounts', 'totalDebit', 'totalCredit']
  },
  {
    name: 'General Ledger',
    endpoint: 'general-ledger',
    params: {
      fromDate: '2024-10-01',
      toDate: TEST_DATE
    },
    expectedFields: ['accounts', 'transactions']
  }
];

// Logging functions
function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync('development.log', logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

function logTestStart(testName: string) {
  const separator = '='.repeat(60);
  const message = `\n${separator}\nTesting ${testName}\n${separator}`;
  console.log(message);
  logToFile(message);
}

function logTestResult(success: boolean, message: string, details?: any) {
  const icon = success ? '✅' : '❌';
  const fullMessage = `${icon} ${message}`;
  console.log(fullMessage);
  logToFile(fullMessage);
  
  if (details) {
    const detailsStr = JSON.stringify(details, null, 2);
    console.log(`   Details: ${detailsStr}`);
    logToFile(`   Details: ${detailsStr}`);
  }
}

// Database verification functions
async function verifyDatabaseStorage(reportType: string, periodStart: Date, periodEnd: Date) {
  try {
    const reportData = await prisma.reportData.findFirst({
      where: {
        reportType: reportType,
        periodStart: {
          gte: new Date(periodStart.getTime() - 24 * 60 * 60 * 1000), // Allow 1 day tolerance
          lte: new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
        },
        periodEnd: {
          gte: new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (reportData) {
      logTestResult(true, 'Data found in ReportData table', {
        id: reportData.id,
        createdAt: reportData.createdAt,
        isActive: reportData.isActive
      });
      return true;
    } else {
      logTestResult(false, 'No data found in ReportData table');
      return false;
    }
  } catch (error) {
    logTestResult(false, 'Error checking database', error);
    return false;
  }
}

async function verifyImportedReport(reportType: string, periodStart: Date, periodEnd: Date) {
  try {
    const importedReport = await prisma.importedReport.findFirst({
      where: {
        type: reportType,
        source: 'API',
        periodStart: {
          gte: new Date(periodStart.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
        },
        periodEnd: {
          gte: new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (importedReport) {
      logTestResult(true, 'Import record found in ImportedReport table', {
        id: importedReport.id,
        status: importedReport.status,
        recordCount: importedReport.recordCount,
        createdAt: importedReport.createdAt
      });
      return true;
    } else {
      logTestResult(false, 'No import record found in ImportedReport table');
      return false;
    }
  } catch (error) {
    logTestResult(false, 'Error checking imported reports', error);
    return false;
  }
}

// Main test function for each endpoint
async function testReportEndpoint(report: typeof REPORT_ENDPOINTS[0]) {
  logTestStart(report.name);
  
  try {
    // Build URL with query parameters
    const params = new URLSearchParams(report.params);
    params.append('refresh', 'true'); // Force fresh data from Xero
    const url = `${BASE_URL}/${report.endpoint}?${params.toString()}`;
    
    logTestResult(true, `Testing URL: ${url}`);
    
    // Make the API request
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      // @ts-ignore
      agent
    });
    
    const duration = Date.now() - startTime;
    logTestResult(true, `Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText
    });
    
    // Parse response
    const responseText = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logTestResult(false, 'Failed to parse JSON response', {
        responseText: responseText.substring(0, 200) + '...'
      });
      return { success: false, error: 'Invalid JSON response' };
    }
    
    // Check for errors in response
    if (!response.ok || data.error) {
      logTestResult(false, `API returned error`, {
        status: response.status,
        error: data.error || 'Unknown error',
        message: data.message
      });
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
    
    // Verify expected fields
    const missingFields = report.expectedFields.filter(field => !(field in data));
    if (missingFields.length > 0) {
      logTestResult(false, 'Missing expected fields', { missingFields });
    } else {
      logTestResult(true, 'All expected fields present');
    }
    
    // Log some key data points
    const keyData: any = {};
    report.expectedFields.forEach(field => {
      if (data[field] !== undefined) {
        keyData[field] = data[field];
      }
    });
    logTestResult(true, 'Key data points', keyData);
    
    // Determine period dates based on report type
    let periodStart: Date, periodEnd: Date;
    
    switch (report.endpoint) {
      case 'profit-loss':
      case 'cash-flow':
        // Monthly reports
        const testDate = new Date(TEST_DATE);
        periodStart = new Date(testDate.getFullYear(), testDate.getMonth(), 1);
        periodEnd = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0);
        break;
        
      case 'balance-sheet':
      case 'trial-balance':
        // Point-in-time reports (use year start to date)
        periodEnd = new Date(TEST_DATE);
        periodStart = new Date(periodEnd.getFullYear(), 0, 1);
        break;
        
      case 'general-ledger':
        // Date range reports
        periodStart = new Date(report.params.fromDate!);
        periodEnd = new Date(report.params.toDate!);
        break;
        
      default:
        periodStart = new Date(TEST_DATE);
        periodEnd = new Date(TEST_DATE);
    }
    
    // Map endpoint names to database report types
    const reportTypeMap: { [key: string]: string } = {
      'profit-loss': 'PROFIT_LOSS',
      'balance-sheet': 'BALANCE_SHEET',
      'cash-flow': 'CASH_FLOW',
      'trial-balance': 'TRIAL_BALANCE',
      'general-ledger': 'GENERAL_LEDGER'
    };
    
    const dbReportType = reportTypeMap[report.endpoint];
    
    // Verify database storage
    logTestResult(true, 'Checking database storage...');
    
    // Wait a bit for database writes to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const reportDataStored = await verifyDatabaseStorage(dbReportType, periodStart, periodEnd);
    const importRecordCreated = await verifyImportedReport(dbReportType, periodStart, periodEnd);
    
    // Overall test result
    const testPassed = response.ok && !data.error && missingFields.length === 0;
    
    return {
      success: testPassed,
      endpoint: report.endpoint,
      name: report.name,
      responseTime: duration,
      dataStored: reportDataStored,
      importRecorded: importRecordCreated,
      hasExpectedFields: missingFields.length === 0,
      error: data.error || (testPassed ? undefined : 'Test failed')
    };
    
  } catch (error) {
    logTestResult(false, `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      error: error instanceof Error ? error.stack : error
    });
    
    return {
      success: false,
      endpoint: report.endpoint,
      name: report.name,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: 0,
      dataStored: false,
      importRecorded: false,
      hasExpectedFields: false
    };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Report Endpoint Tests');
  console.log(`📅 Test Date: ${TEST_DATE}`);
  console.log(`🔐 Using authentication cookie\n`);
  
  logToFile('\n\n========== COMPREHENSIVE REPORT ENDPOINT TESTS ==========');
  logToFile(`Test Date: ${TEST_DATE}`);
  logToFile(`Started at: ${new Date().toISOString()}`);
  
  const results: any[] = [];
  
  // Test each endpoint
  for (const report of REPORT_ENDPOINTS) {
    const result = await testReportEndpoint(report);
    results.push(result);
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful tests: ${successCount}`);
  console.log(`❌ Failed tests: ${failureCount}`);
  console.log(`📈 Total tests: ${results.length}`);
  
  // Detailed summary
  console.log('\nDetailed Results:');
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name || result.endpoint}:`);
    console.log(`   - Endpoint: ${result.endpoint}`);
    console.log(`   - Response Time: ${result.responseTime || 'N/A'}ms`);
    console.log(`   - Data Stored: ${result.dataStored ? 'Yes' : 'No'}`);
    console.log(`   - Import Recorded: ${result.importRecorded ? 'Yes' : 'No'}`);
    console.log(`   - Has Expected Fields: ${result.hasExpectedFields ? 'Yes' : 'No'}`);
    if (result.error) {
      console.log(`   - Error: ${result.error}`);
    }
  });
  
  // Log summary to file
  logToFile('\n========== TEST SUMMARY ==========');
  logToFile(`Successful tests: ${successCount}`);
  logToFile(`Failed tests: ${failureCount}`);
  logToFile(`Total tests: ${results.length}`);
  logToFile(`Completed at: ${new Date().toISOString()}`);
  
  // Log to structured logger
  structuredLogger.info('[Report Endpoint Tests] Completed', {
    successCount,
    failureCount,
    totalTests: results.length,
    testDate: TEST_DATE,
    results: results.map(r => ({
      endpoint: r.endpoint,
      success: r.success,
      responseTime: r.responseTime,
      error: r.error
    }))
  });
}

// Error handling and cleanup
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  logToFile(`FATAL ERROR: Unhandled rejection: ${error}`);
  process.exit(1);
});

// Run the tests
runAllTests()
  .catch(error => {
    console.error('Fatal error:', error);
    logToFile(`FATAL ERROR: ${error}`);
    structuredLogger.error('[Report Endpoint Tests] Fatal error', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });