import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const AUTH_COOKIE_ENV = 'FCC_AUTH_COOKIE';
const cookies = process.env[AUTH_COOKIE_ENV];

if (!cookies) {
  throw new Error(
    `Missing authentication cookie. Set ${AUTH_COOKIE_ENV} with a valid central session cookie string (include NextAuth + Xero tokens).`
  );
}

interface CashFlowValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

interface FetchResult {
  success: boolean;
  data?: any;
  error?: string;
  errorDetails?: any;
  httpStatus?: number;
  rawResponse?: string;
  validation?: CashFlowValidation;
}

// Validate cash flow numbers for reasonableness
function validateCashFlowNumbers(data: any): CashFlowValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;

  try {
    const netCashFlow = data.summary?.netCashFlow || 0;
    const openingBalance = data.summary?.openingBalance || 0;
    const closingBalance = data.summary?.closingBalance || 0;
    const operatingCash = data.operatingActivities?.netCashFromOperating || 0;
    const investingCash = data.investingActivities?.netCashFromInvesting || 0;
    const financingCash = data.financingActivities?.netCashFromFinancing || 0;
    
    // Check if the fundamental equation holds
    const calculatedNetCashFlow = operatingCash + investingCash + financingCash;
    const calculatedClosingBalance = openingBalance + netCashFlow;
    
    // Allow for small rounding differences (0.01)
    if (Math.abs(calculatedNetCashFlow - netCashFlow) > 0.01) {
      errors.push(`Net cash flow mismatch: Calculated ${calculatedNetCashFlow.toFixed(2)}, Reported ${netCashFlow.toFixed(2)}`);
      isValid = false;
    }
    
    if (Math.abs(calculatedClosingBalance - closingBalance) > 0.01) {
      errors.push(`Closing balance mismatch: Opening ${openingBalance.toFixed(2)} + Net Flow ${netCashFlow.toFixed(2)} = ${calculatedClosingBalance.toFixed(2)}, but reported ${closingBalance.toFixed(2)}`);
      isValid = false;
    }
    
    // Reasonableness checks
    const absNetCashFlow = Math.abs(netCashFlow);
    const absOperating = Math.abs(operatingCash);
    const absInvesting = Math.abs(investingCash);
    const absFinancing = Math.abs(financingCash);
    
    // Warning if any single cash flow is extremely large (over £10M)
    if (absOperating > 10000000) {
      warnings.push(`Very large operating cash flow: £${operatingCash.toFixed(2)}`);
    }
    if (absInvesting > 10000000) {
      warnings.push(`Very large investing cash flow: £${investingCash.toFixed(2)}`);
    }
    if (absFinancing > 10000000) {
      warnings.push(`Very large financing cash flow: £${financingCash.toFixed(2)}`);
    }
    
    // Warning if negative cash balance
    if (closingBalance < 0) {
      warnings.push(`Negative closing cash balance: £${closingBalance.toFixed(2)}`);
    }
    
    // Warning if all activities are zero (might indicate no data)
    if (operatingCash === 0 && investingCash === 0 && financingCash === 0) {
      warnings.push('All cash flow activities are zero - may indicate no transactions');
    }
    
    // Check for unusual patterns
    if (operatingCash < 0 && Math.abs(operatingCash) > absInvesting + absFinancing) {
      warnings.push('Negative operating cash flow exceeds investing and financing combined');
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isValid = false;
  }
  
  return { isValid, warnings, errors };
}

async function fetchCashFlowData(month: number, year: number, description: string): Promise<FetchResult> {
  try {
    console.log(`📊 Fetching ${description}...`);
    
    const url = `https://localhost:3003/api/v1/xero/reports/cash-flow?month=${month}&year=${year}&refresh=true`;
    
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
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0);
        
        await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            source: 'API',
            periodStart: periodStart,
            periodEnd: periodEnd,
            importedBy: 'HistoricalCashFlowFetchScript',
            status: 'FAILED',
            recordCount: 0,
            errorLog: errorResult.error,
            rawData: JSON.stringify(errorResult.errorDetails),
            metadata: JSON.stringify({
              fetchDate: new Date().toISOString(),
              scriptName: 'fetch-all-historical-cash-flow.ts',
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
    
    // Validate the numbers
    const validation = validateCashFlowNumbers(responseData);
    
    // Log summary
    const summary = responseData.summary || {};
    console.log(`   💰 Cash Flow Summary:`);
    console.log(`      Opening Balance: £${summary.openingBalance?.toFixed(2) || 0}`);
    console.log(`      Operating: £${responseData.operatingActivities?.netCashFromOperating?.toFixed(2) || 0}`);
    console.log(`      Investing: £${responseData.investingActivities?.netCashFromInvesting?.toFixed(2) || 0}`);
    console.log(`      Financing: £${responseData.financingActivities?.netCashFromFinancing?.toFixed(2) || 0}`);
    console.log(`      Net Cash Flow: £${summary.netCashFlow?.toFixed(2) || 0}`);
    console.log(`      Closing Balance: £${summary.closingBalance?.toFixed(2) || 0}`);
    
    // Log validation results
    if (!validation.isValid) {
      console.error(`   ❌ Validation Failed:`);
      validation.errors.forEach(error => console.error(`      - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`   ⚠️  Validation Warnings:`);
      validation.warnings.forEach(warning => console.warn(`      - ${warning}`));
    }
    
    // Store successful fetch in database
    try {
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);
      
      // Create ImportedReport entry
      const importedReport = await prisma.importedReport.create({
        data: {
          type: 'CASH_FLOW',
          source: 'API',
          periodStart: periodStart,
          periodEnd: periodEnd,
          importedBy: 'HistoricalCashFlowFetchScript',
          status: validation.isValid ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
          recordCount: 1,
          errorLog: validation.errors.length > 0 ? validation.errors.join('; ') : null,
          rawData: JSON.stringify(responseData),
          metadata: JSON.stringify({
            fetchDate: new Date().toISOString(),
            scriptName: 'fetch-all-historical-cash-flow.ts',
            validation: validation,
            summary: {
              openingBalance: summary.openingBalance,
              operatingCash: responseData.operatingActivities?.netCashFromOperating,
              investingCash: responseData.investingActivities?.netCashFromInvesting,
              financingCash: responseData.financingActivities?.netCashFromFinancing,
              netCashFlow: summary.netCashFlow,
              closingBalance: summary.closingBalance
            }
          })
        }
      });
      console.log(`   ✅ Stored in ImportedReport${!validation.isValid ? ' (with warnings)' : ''}`);
      
      // Also store in ReportData table for quick access
      // First, deactivate any existing active entries for this period
      await prisma.reportData.updateMany({
        where: {
          reportType: 'CASH_FLOW',
          periodStart: periodStart,
          periodEnd: periodEnd,
          isActive: true
        },
        data: {
          isActive: false
        }
      });
      
      // Create new ReportData entry
      await prisma.reportData.create({
        data: {
          reportType: 'CASH_FLOW',
          periodStart: periodStart,
          periodEnd: periodEnd,
          data: JSON.stringify(responseData),
          isActive: true,
          version: 1,
          importedReportId: importedReport.id
        }
      });
      console.log(`   ✅ Stored in ReportData for quick access`);
    } catch (dbError) {
      console.error(`   ⚠️  Failed to store in database: ${dbError}`);
    }
    
    return { 
      success: true, 
      data: responseData,
      rawResponse: responseText,
      validation: validation
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed: ${errorMessage}`);
    
    // Store network/system errors
    try {
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);
      
      await prisma.importedReport.create({
        data: {
          type: 'CASH_FLOW',
          source: 'API',
          periodStart: periodStart,
          periodEnd: periodEnd,
          importedBy: 'HistoricalCashFlowFetchScript',
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
            scriptName: 'fetch-all-historical-cash-flow.ts',
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

async function clearExistingData(month: number, year: number) {
  try {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    const deleted = await prisma.reportData.deleteMany({
      where: {
        reportType: 'CASH_FLOW',
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

async function fetchAllHistoricalCashFlow() {
  console.log('=== FETCHING ALL HISTORICAL CASH FLOW DATA ===\n');
  console.log('This will fetch monthly cash flow statements from January 2021 to present.\n');
  console.log('⚠️  IMPORTANT: Validating all numbers for reasonableness\n');
  
  const startYear = 2021;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let successCount = 0;
  let failureCount = 0;
  let warningCount = 0;
  const failureDetails: { date: string; error: string; details?: any }[] = [];
  const validationIssues: { date: string; issues: CashFlowValidation }[] = [];
  
  // Fetch all monthly cash flow statements
  console.log('📅 FETCHING MONTHLY CASH FLOW STATEMENTS\n');
  
  for (let year = startYear; year <= currentYear; year++) {
    console.log(`\n--- Year ${year} ---`);
    
    const maxMonth = (year === currentYear) ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      // Clear existing data for this period
      await clearExistingData(month, year);
      
      const result = await fetchCashFlowData(month, year, `${monthName} ${year} Cash Flow`);
      
      if (result.success) {
        successCount++;
        
        if (result.validation && !result.validation.isValid) {
          warningCount++;
          validationIssues.push({
            date: `${year}-${month.toString().padStart(2, '0')}`,
            issues: result.validation
          });
        }
      } else {
        failureCount++;
        failureDetails.push({
          date: `${year}-${month.toString().padStart(2, '0')}`,
          error: result.error || 'Unknown error',
          details: result.errorDetails
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`✅ Successful fetches: ${successCount}`);
  console.log(`⚠️  Fetches with warnings: ${warningCount}`);
  console.log(`❌ Failed fetches: ${failureCount}`);
  console.log(`📊 Total attempts: ${successCount + failureCount}`);
  
  if (validationIssues.length > 0) {
    console.log('\n=== VALIDATION ISSUES ===');
    validationIssues.forEach(issue => {
      console.log(`\n📅 ${issue.date}:`);
      if (issue.issues.errors.length > 0) {
        console.log('   Errors:');
        issue.issues.errors.forEach(error => console.log(`   - ${error}`));
      }
      if (issue.issues.warnings.length > 0) {
        console.log('   Warnings:');
        issue.issues.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
    });
  }
  
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
  structuredLogger.info('[Historical Cash Flow Fetch] Completed', {
    successCount,
    warningCount,
    failureCount,
    totalAttempts: successCount + failureCount,
    dateRange: `${startYear}-01 to ${currentYear}-${currentMonth.toString().padStart(2, '0')}`,
    validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
    failureDetails: failureDetails.length > 0 ? failureDetails : undefined
  });
  
  console.log('\n✅ Cash flow data fetch completed. Check the logs for detailed validation results.');
}

// Run the historical data fetch
fetchAllHistoricalCashFlow()
  .catch(error => {
    console.error('Fatal error:', error);
    structuredLogger.error('[Historical Cash Flow Fetch] Fatal error', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });
