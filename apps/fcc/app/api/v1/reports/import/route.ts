import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'
import * as xlsx from 'xlsx'
import { parse } from 'csv-parse/sync'
import { XeroBalanceSheetParser } from '@/lib/parsers/xero-balance-sheet-parser'
import { XeroProfitLossParser } from '@/lib/parsers/xero-profit-loss-parser'
import { XeroTrialBalanceParser } from '@/lib/parsers/xero-trial-balance-parser'
import { XeroCashFlowParser } from '@/lib/parsers/xero-cash-flow-parser'

interface ImportedData {
  reportType: string
  periodStart: string
  periodEnd: string
  data: any[]
}

export async function POST(request: NextRequest) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER)
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userEmail = session.user.email

    const formData = await request.formData()
    const file = formData.get('file') as File
    const reportType = formData.get('reportType') as string
    const periodStart = formData.get('periodStart') as string
    const periodEnd = formData.get('periodEnd') as string

    if (!file || !reportType || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    structuredLogger.info('[Import API] Starting report import', {
      reportType,
      periodStart,
      periodEnd,
      fileName: file.name,
      fileSize: file.size
    })

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    let parsedData: any[] = []

    // Parse file based on type
    if (file.name.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      
      // For certain reports, preserve raw structure for specialized parsers
      if (reportType === 'BALANCE_SHEET' || reportType === 'PROFIT_LOSS' || 
          reportType === 'TRIAL_BALANCE' || reportType === 'CASH_FLOW') {
        parsedData = parse(text, {
          columns: false, // Get raw array format
          skip_empty_lines: false, // Keep structure
          trim: true,
          relax_quotes: true
        })
      } else {
        parsedData = parse(text, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        })
      }
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // For certain reports, get raw data for specialized parsers
      if (reportType === 'BALANCE_SHEET' || reportType === 'PROFIT_LOSS' || 
          reportType === 'TRIAL_BALANCE' || reportType === 'CASH_FLOW') {
        parsedData = xlsx.utils.sheet_to_json(worksheet, { 
          header: 1, // Return array of arrays
          raw: false,
          blankrows: true // Keep blank rows for structure
        })
      } else {
        parsedData = xlsx.utils.sheet_to_json(worksheet, { raw: false })
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format' },
        { status: 400 }
      )
    }

    if (parsedData.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      )
    }

    structuredLogger.info('[Import API] Parsed file data', {
      recordCount: parsedData.length,
      columns: Object.keys(parsedData[0]),
      reportType,
      firstRow: parsedData[0],
      dataStructure: Array.isArray(parsedData[0]) ? 'array of arrays' : 'array of objects'
    })

    // Process the data first to validate it
    let processedData;
    let importedReport;
    
    try {
      // Create a temporary ID for processing
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      processedData = await processReportData(
        reportType,
        parsedData,
        new Date(periodStart),
        new Date(periodEnd),
        tempId
      )
      
      structuredLogger.info('[Import API] Processed report data', {
        reportType,
        processedDataKeys: Object.keys(processedData || {}),
        hasRevenue: !!(processedData && processedData.revenue),
        hasExpenses: !!(processedData && processedData.expenses),
        totalRevenue: processedData?.totalRevenue,
        totalExpenses: processedData?.totalExpenses
      })

      // Only create the import record if processing succeeded
      importedReport = await prisma.importedReport.create({
        data: {
          type: reportType,
          source: file.name.endsWith('.csv') ? 'csv' : 'excel',
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          importedBy: userEmail,
          fileName: file.name,
          fileSize: file.size,
          rawData: JSON.stringify(parsedData),
          processedData: JSON.stringify(processedData),
          status: 'completed',
          recordCount: parsedData.length
        }
      })

      // Store the report data for API access
      const storedReport = await prisma.reportData.create({
        data: {
          reportType,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          data: JSON.stringify(processedData),
          importedReportId: importedReport.id
        }
      })

      structuredLogger.info('[Import API] Report import completed and stored', {
        importId: importedReport.id,
        reportDataId: storedReport.id,
        reportType,
        periodStart,
        periodEnd,
        recordCount: parsedData.length,
        processedData: reportType === 'BALANCE_SHEET' ? {
          totalAssets: processedData.totalAssets,
          totalLiabilities: processedData.totalLiabilities,
          netAssets: processedData.netAssets
        } : undefined
      })

      return NextResponse.json({
        success: true,
        importId: importedReport.id,
        recordCount: parsedData.length,
        message: 'Report imported successfully'
      })

    } catch (error) {
      // If processing failed, don't create a record at all
      structuredLogger.error('[Import API] Error processing report data', error)
      return NextResponse.json(
        { 
          error: 'Failed to process report data',
          message: error instanceof Error ? error.message : 'Unknown error occurred during processing',
          details: 'The file was parsed successfully but could not be processed. Please check the file format and try again.'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    structuredLogger.error('[Import API] Error importing report', error)
    return NextResponse.json(
      { 
        error: 'Failed to import report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function processReportData(
  reportType: string,
  data: any[],
  periodStart: Date,
  periodEnd: Date,
  importedReportId: string
): Promise<any> {
  switch (reportType) {
    case 'BALANCE_SHEET':
      return processBalanceSheet(data, periodEnd, importedReportId)
    case 'PROFIT_LOSS':
      return processProfitLoss(data, periodStart, periodEnd, importedReportId)
    case 'CASH_FLOW':
      return processCashFlow(data, periodStart, periodEnd, importedReportId)
    case 'BANK_SUMMARY':
      return processBankSummary(data, periodStart, periodEnd)
    case 'TRIAL_BALANCE':
      return processTrialBalance(data, periodEnd, importedReportId)
    default:
      throw new Error(`Unsupported report type: ${reportType}`)
  }
}

function processBalanceSheet(data: any[], periodEnd: Date, importedReportId: string): any {
  // Format the target date for column detection (e.g., '30 Jun 2025')
  const targetDate = formatDateForXeroColumn(periodEnd)
  
  // Always use the XeroBalanceSheetParser regardless of data format
  const parsed = XeroBalanceSheetParser.parse(data as string[][], targetDate)
  return XeroBalanceSheetParser.toImportFormat(parsed, periodEnd)
}

function processProfitLoss(data: any[], periodStart: Date, periodEnd: Date, importedReportId: string): any {
  structuredLogger.info('[Import API] Processing Profit & Loss data', {
    dataLength: data.length,
    dataType: Array.isArray(data[0]) ? 'array of arrays' : 'array of objects',
    firstRow: data[0],
    importedReportId
  })
  
  // Always use the XeroProfitLossParser regardless of data format
  const parsed = XeroProfitLossParser.parse(data as string[][])
  const result = XeroProfitLossParser.toImportFormat(parsed, periodStart, periodEnd)
  
  structuredLogger.info('[Import API] Profit & Loss parsed result', {
    hasRevenue: !!result.revenue,
    hasExpenses: !!result.expenses,
    revenueCount: result.revenue?.length || 0,
    expensesCount: result.expenses?.length || 0,
    totalRevenue: result.totalRevenue,
    totalExpenses: result.totalExpenses,
    importedReportId
  })
  
  return result
}

function processCashFlow(data: any[], periodStart: Date, periodEnd: Date, importedReportId: string): any {
  // Always use the XeroCashFlowParser regardless of data format
  const parsed = XeroCashFlowParser.parse(data as string[][])
  return XeroCashFlowParser.toImportFormat(parsed, periodStart, periodEnd)
}

function processBankSummary(data: any[], periodStart: Date, periodEnd: Date): any {
  // Parse bank summary data
  const accounts: any[] = []
  const accountTypes: { [key: string]: { balance: number, count: number } } = {}
  let totalBalance = 0
  let activeAccounts = 0
  let inactiveAccounts = 0

  data.forEach((row, index) => {
    const accountName = row['Account'] || row['Bank Account'] || 'Unknown'
    const balance = parseFloat(row['Balance'] || row['Current Balance'] || '0')
    const currency = row['Currency'] || 'GBP'
    const accountType = row['Type'] || 'Bank'
    const isActive = row['Status'] !== 'Inactive'

    totalBalance += balance
    if (isActive) {
      activeAccounts++
    } else {
      inactiveAccounts++
    }

    // Track account types
    if (!accountTypes[accountType]) {
      accountTypes[accountType] = { balance: 0, count: 0 }
    }
    accountTypes[accountType].balance += balance
    accountTypes[accountType].count++

    accounts.push({
      accountId: `account-${index + 1}`,
      accountName,
      accountType,
      balance,
      currencyCode: currency,
      isActive,
      bankAccountNumber: row['Account Number'] || undefined
    })
  })

  // Convert accountTypes to array format
  const accountTypesArray = Object.entries(accountTypes).map(([type, data]) => ({
    type,
    balance: data.balance,
    count: data.count
  }))

  return {
    accounts,
    accountTypes: accountTypesArray,
    summary: {
      totalBalance,
      totalActiveAccounts: activeAccounts,
      totalInactiveAccounts: inactiveAccounts,
      cashEquivalents: totalBalance, // Simplified assumption
      liquidityRatio: 100 // Simplified assumption
    },
    reportDate: periodEnd.toISOString()
  }
}

function processTrialBalance(data: any[], periodEnd: Date, importedReportId: string): any {
  structuredLogger.info('[Import API] Processing Trial Balance data', {
    recordCount: data.length,
    importedReportId
  })

  // Always use the XeroTrialBalanceParser regardless of data format
  const parsed = XeroTrialBalanceParser.parse(data as string[][])
  const result = XeroTrialBalanceParser.toImportFormat(parsed, periodEnd)

  structuredLogger.info('[Import API] Trial Balance processed', {
    totalAccounts: result.accounts.length,
    totalDebits: result.totals.totalDebits,
    totalCredits: result.totals.totalCredits,
    isBalanced: result.totals.isBalanced,
    importedReportId
  })

  return result
}

/**
 * Format a date for Xero column detection
 * Converts a Date object to the format used in Xero CSV headers (e.g., '30 Jun 2025')
 */
function formatDateForXeroColumn(date: Date): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const day = date.getDate()
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear()
  
  return `${day} ${month} ${year}`
}