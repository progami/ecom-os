#!/usr/bin/env npx tsx
import { PrismaClient } from '@prisma/client'
import { XeroClient } from '@xeroapi/xero-node'
import fs from 'fs'

const prisma = new PrismaClient()

// Parse the Xero token from the cookie value
const cookieTokenValue = '%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0NzUwOTgsImV4cCI6MTc1MTQ3Njg5OCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQ3NTA5NCwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6ImFhYWFlMDQ1MDNlNTQ0YzI5MTE3NzZlNWFhZGY1YTc1Iiwic2lkIjoiYWFhYWUwNDUwM2U1NDRjMjkxMTc3NmU1YWFkZjVhNzUiLCJqdGkiOiI5NTU5RjZFQjFBOUFDMjgzODI3RkNBRkEwMzE0NEVFOSIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiYmIwM2FlODEtMDgyYS00NmQ4LWExNzUtYjgxYzAwY2RiZTA0Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.L12-4A6j4pxQP6c9kL4H78ikJFTb4r2acllG4NKd3YkOxhe3cTJSlDlnUZl2_ONgdPx36un3XZl7XtcPdl4e14tuxlbfqNYsX576PZXGdXqvAbN2IlOeP6Qf2E8_kMpMhu0IPB2-I9YJ66Uu95S43SFLAHyRRcmR0VYC8duU3f9p9yuHwwhAkeoNXRkyBo2asGF9vcqfF0Pk31ZFi2o5kTuX3CjERGiItG8oIe4Gjtw8mQ9DTVrY6NnJceVb7LTkCmA7iS8zLGerOUq7Hq9H33zh5xDbey0EZ4jW2wS3LeDDHpxGA4goT-VQVDQVBgZii82F9NABpC-s2dvHGUqC7Q%22%2C%22refresh_token%22%3A%22815UN9vyiirBvGB4TEGP9Iw-byN0-ty6uimW54uvShs%22%2C%22expires_at%22%3A1751476898%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'

// Decode the URL-encoded token
const decodedToken = decodeURIComponent(cookieTokenValue)
const tokenData = JSON.parse(decodedToken)

async function fetchAndStoreCashFlow() {
  try {
    // Log to development.log
    const log = (message: string) => {
      const timestamp = new Date().toISOString()
      const logMessage = `[${timestamp}] [CASH_FLOW_DIRECT] ${message}\n`
      fs.appendFileSync('development.log', logMessage)
      console.log(message)
    }

    log('Starting direct Xero Cash Flow fetch')

    // Get tenant info
    const tenant = await prisma.xeroTenant.findFirst({
      where: { tenantName: 'TRADEMAN ENTERPRISE LTD' }
    })

    if (!tenant) {
      throw new Error('No tenant found')
    }

    log(`Found tenant: ${tenant.tenantName} (${tenant.tenantId})`)

    // Create Xero client with the token
    const xeroClient = new XeroClient({
      clientId: '781184D1AD314CB6989EB8D2291AB453',
      clientSecret: process.env.XERO_CLIENT_SECRET || '',
      redirectUris: ['https://localhost:3003/api/auth/callback/xero'],
      scopes: tokenData.scope.split(' ')
    })

    // Set the token
    await xeroClient.setTokenSet({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    })

    // Define periods to fetch
    const periods = [
      { from: '2024-01-01', to: '2024-01-31' },
      { from: '2024-02-01', to: '2024-02-29' },
      { from: '2024-03-01', to: '2024-03-31' },
      { from: '2024-04-01', to: '2024-04-30' },
      { from: '2024-05-01', to: '2024-05-31' },
      { from: '2024-06-01', to: '2024-06-30' }
    ]

    for (const period of periods) {
      log(`Fetching Bank Summary for ${period.from} to ${period.to}`)

      try {
        // Fetch Bank Summary from Xero
        const response = await xeroClient.accountingApi.getReportBankSummary(
          tenant.tenantId,
          new Date(period.from),
          new Date(period.to)
        )

        if (!response?.body?.reports?.[0]) {
          log(`No data returned for ${period.from} to ${period.to}`)
          continue
        }

        const report = response.body.reports[0]
        log(`Got Bank Summary data with ${report.rows?.length || 0} rows`)

        // Transform Bank Summary to Cash Flow Statement format
        const cashFlowData = transformBankSummaryToCashFlow(report, period.from, period.to)

        // Store in database
        const importRecord = await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            status: 'COMPLETED',
            importedBy: 'system',
            recordCount: 1,
            filters: {
              dateRange: {
                from: period.from,
                to: period.to
              }
            }
          }
        })

        await prisma.reportData.create({
          data: {
            reportType: 'CASH_FLOW',
            period: `${period.from} to ${period.to}`,
            fromDate: new Date(period.from),
            toDate: new Date(period.to),
            data: cashFlowData as any,
            importedReportId: importRecord.id
          }
        })

        log(`Successfully stored Cash Flow data for ${period.from} to ${period.to}`)
        log(`Total Net Cash Flow: ${cashFlowData.totalNetCashFlow}`)

      } catch (error) {
        log(`Error fetching ${period.from}: ${error.message}`)
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    log('Cash Flow fetch completed')

  } catch (error) {
    console.error('Error:', error)
    fs.appendFileSync('development.log', `[${new Date().toISOString()}] [CASH_FLOW_DIRECT] Error: ${error.message}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

function transformBankSummaryToCashFlow(bankSummary: any, fromDate: string, toDate: string) {
  // Initialize cash flow structure
  const cashFlow = {
    reportName: 'Cash Flow Statement',
    fromDate,
    toDate,
    operatingActivities: [] as any[],
    investingActivities: [] as any[],
    financingActivities: [] as any[],
    netOperatingCashFlow: 0,
    netInvestingCashFlow: 0,
    netFinancingCashFlow: 0,
    totalNetCashFlow: 0,
    openingBalance: 0,
    closingBalance: 0,
    fetchedAt: new Date().toISOString()
  }

  // Process bank summary rows
  if (bankSummary.rows) {
    for (const row of bankSummary.rows) {
      if (row.rowType === 'Row' && row.cells) {
        const accountName = row.cells[0]?.value || ''
        const openingBalance = parseFloat(row.cells[1]?.value || '0')
        const cashReceived = parseFloat(row.cells[2]?.value || '0')
        const cashSpent = parseFloat(row.cells[3]?.value || '0')
        const closingBalance = parseFloat(row.cells[4]?.value || '0')
        const netMovement = parseFloat(row.cells[5]?.value || '0')

        // Add to opening/closing balance totals
        cashFlow.openingBalance += openingBalance
        cashFlow.closingBalance += closingBalance

        // Categorize cash movements based on account name
        if (cashReceived > 0 || cashSpent > 0) {
          const activity = {
            name: accountName,
            amount: netMovement
          }

          // Simple categorization based on account name patterns
          if (accountName.toLowerCase().includes('loan') || 
              accountName.toLowerCase().includes('investment') ||
              accountName.toLowerCase().includes('capital')) {
            cashFlow.financingActivities.push(activity)
            cashFlow.netFinancingCashFlow += netMovement
          } else if (accountName.toLowerCase().includes('asset') ||
                     accountName.toLowerCase().includes('equipment') ||
                     accountName.toLowerCase().includes('property')) {
            cashFlow.investingActivities.push(activity)
            cashFlow.netInvestingCashFlow += netMovement
          } else {
            // Default to operating activities
            cashFlow.operatingActivities.push(activity)
            cashFlow.netOperatingCashFlow += netMovement
          }
        }
      }
    }
  }

  // Calculate total net cash flow
  cashFlow.totalNetCashFlow = cashFlow.netOperatingCashFlow + 
                              cashFlow.netInvestingCashFlow + 
                              cashFlow.netFinancingCashFlow

  // If no categorized activities, create a summary entry
  if (cashFlow.operatingActivities.length === 0 && 
      cashFlow.investingActivities.length === 0 && 
      cashFlow.financingActivities.length === 0) {
    cashFlow.operatingActivities.push({
      name: 'Net Cash Movement',
      amount: cashFlow.closingBalance - cashFlow.openingBalance
    })
    cashFlow.netOperatingCashFlow = cashFlow.closingBalance - cashFlow.openingBalance
    cashFlow.totalNetCashFlow = cashFlow.netOperatingCashFlow
  }

  return cashFlow
}

// Run the script
fetchAndStoreCashFlow()