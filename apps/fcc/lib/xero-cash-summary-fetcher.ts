import { XeroAccountingApi, TokenSet } from 'xero-node'
import { getXeroClient, executeXeroAPICall } from '@/lib/xero-client'
import { structuredLogger } from '@/lib/logger'
import { CashSummaryData, CashSummarySection, CashSummaryLineItem, CashSummaryAccountCategory } from '@/lib/types/cash-summary'
import { XeroReportFetcher } from '@/lib/xero-report-fetcher'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

/**
 * Xero Cash Summary Fetcher
 * 
 * Since Xero doesn't provide a direct Cash Summary API endpoint,
 * this class reconstructs the cash summary by:
 * 1. Fetching P&L data for income and expenses
 * 2. Fetching Balance Sheet movements for assets and liabilities
 * 3. Fetching Journal entries for VAT movements
 * 4. Calculating foreign currency gains/losses
 * 5. Computing cash flow movements
 */
export class XeroCashSummaryFetcher {
  /**
   * Fetch Cash Summary data for multiple periods
   * @param tenantId - The Xero tenant ID
   * @param endDate - The end date of the report period
   * @param periods - Number of monthly periods to include (default: 5)
   */
  static async fetchCashSummary(
    tenantId: string,
    endDate: Date = new Date(),
    periods: number = 5
  ): Promise<CashSummaryData> {
    structuredLogger.info('[XeroCashSummaryFetcher] Starting cash summary fetch', {
      tenantId,
      endDate: endDate.toISOString(),
      periods
    })

    try {
      // Get Xero client
      const xeroClient = await getXeroClient()

      // Generate period dates
      const periodDates = this.generatePeriodDates(endDate, periods)
      
      // Fetch data for each period
      const periodData = await Promise.all(
        periodDates.map(period => 
          this.fetchPeriodData(xeroClient, tenantId, period.start, period.end, period.label)
        )
      )

      // Combine all period data into the cash summary structure
      const cashSummary = this.combinePeriodData(periodData, 'Cash Summary')

      structuredLogger.info('[XeroCashSummaryFetcher] Successfully generated cash summary', {
        tenantId,
        periods: cashSummary.periods.length
      })

      return cashSummary

    } catch (error) {
      structuredLogger.error('[XeroCashSummaryFetcher] Error fetching cash summary', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * Generate period dates for the report
   */
  private static generatePeriodDates(endDate: Date, periods: number) {
    const dates = []
    
    for (let i = 0; i < periods; i++) {
      const periodEnd = endOfMonth(subMonths(endDate, i))
      const periodStart = startOfMonth(periodEnd)
      const label = format(periodEnd, 'MMM yyyy')
      
      dates.push({
        start: periodStart,
        end: periodEnd,
        label
      })
    }
    
    return dates.reverse() // Oldest to newest
  }

  /**
   * Fetch all data for a single period
   */
  private static async fetchPeriodData(
    xeroClient: XeroAccountingApi,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    periodLabel: string
  ) {
    structuredLogger.info('[XeroCashSummaryFetcher] Fetching period data', {
      period: periodLabel,
      start: startDate.toISOString(),
      end: endDate.toISOString()
    })

    try {
      // Fetch multiple reports in parallel
      const [
        profitLoss,
        balanceSheet,
        bankTransactions,
        journals
      ] = await Promise.all([
        // Detailed P&L for income and expenses
        XeroReportFetcher.fetchDetailedProfitLoss(tenantId, startDate, endDate),
        
        // Balance Sheet for opening/closing balances
        XeroReportFetcher.fetchDetailedBalanceSheet(tenantId, endDate),
        
        // Bank transactions for cash movements
        this.fetchBankTransactions(xeroClient, tenantId, startDate, endDate),
        
        // Journal entries for VAT and other movements
        this.fetchJournalEntries(xeroClient, tenantId, startDate, endDate)
      ])

      // Process the data into cash summary format
      return this.processPeriodData(
        periodLabel,
        profitLoss,
        balanceSheet,
        bankTransactions,
        journals
      )

    } catch (error) {
      structuredLogger.error('[XeroCashSummaryFetcher] Error fetching period data', {
        period: periodLabel,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Return empty period data on error
      return this.createEmptyPeriodData(periodLabel)
    }
  }

  /**
   * Fetch bank transactions for the period
   */
  private static async fetchBankTransactions(
    xeroClient: XeroAccountingApi,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getBankTransactions(
          tenantId,
          undefined, // ifModifiedSince
          `Date >= DateTime(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()}) AND Date <= DateTime(${endDate.getFullYear()}, ${endDate.getMonth() + 1}, ${endDate.getDate()})`,
          undefined, // order
          undefined, // page
          100 // unitdp
        )
      )

      return response.body?.bankTransactions || []
    } catch (error) {
      structuredLogger.error('[XeroCashSummaryFetcher] Error fetching bank transactions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  /**
   * Fetch journal entries for VAT and other movements
   */
  private static async fetchJournalEntries(
    xeroClient: XeroAccountingApi,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      // Fetch manual journals
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getManualJournals(
          tenantId,
          undefined, // ifModifiedSince
          `Date >= DateTime(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()}) AND Date <= DateTime(${endDate.getFullYear()}, ${endDate.getMonth() + 1}, ${endDate.getDate()})`,
          undefined, // order
          undefined  // page
        )
      )

      return response.body?.manualJournals || []
    } catch (error) {
      structuredLogger.error('[XeroCashSummaryFetcher] Error fetching journal entries', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  /**
   * Process period data into cash summary format
   */
  private static processPeriodData(
    periodLabel: string,
    profitLoss: any,
    balanceSheet: any,
    bankTransactions: any[],
    journals: any[]
  ) {
    // Extract income items from P&L
    const incomeItems = this.extractIncomeItems(profitLoss, periodLabel)
    
    // Extract expense items from P&L
    const expenseItems = this.extractExpenseItems(profitLoss, periodLabel)
    
    // Extract VAT movements from journals and bank transactions
    const vatMovements = this.extractVATMovements(journals, bankTransactions, periodLabel)
    
    // Extract fixed asset movements from balance sheet
    const assetMovements = this.extractAssetMovements(balanceSheet, periodLabel)
    
    // Calculate foreign currency gains/losses
    const currencyMovements = this.calculateCurrencyMovements(bankTransactions, periodLabel)
    
    // Get cash balances from balance sheet
    const cashBalances = this.extractCashBalances(balanceSheet, periodLabel)

    return {
      period: periodLabel,
      income: incomeItems,
      expenses: expenseItems,
      vatMovements,
      assetMovements,
      currencyMovements,
      cashBalances
    }
  }

  /**
   * Extract income items from P&L report
   */
  private static extractIncomeItems(profitLoss: any, period: string): Record<string, number> {
    const items: Record<string, number> = {}
    
    // Map P&L accounts to cash summary categories
    const incomeMapping = {
      'Sales': CashSummaryAccountCategory.AMAZON_SALES_LMB,
      'Other Revenue': CashSummaryAccountCategory.WISE_CASHBACK,
      'Inventory Adjustments': CashSummaryAccountCategory.AMAZON_FBA_INVENTORY_REIMBURSEMENT,
      'Sales Returns': CashSummaryAccountCategory.AMAZON_REFUNDS
    }

    // Process income accounts from P&L
    if (profitLoss?.income?.byAccount) {
      for (const account of profitLoss.income.byAccount) {
        const mappedCategory = this.mapAccountToCategory(account.accountName, incomeMapping)
        if (mappedCategory) {
          items[mappedCategory] = account.total || 0
        }
      }
    }

    return items
  }

  /**
   * Extract expense items from P&L report
   */
  private static extractExpenseItems(profitLoss: any, period: string): Record<string, number> {
    const items: Record<string, number> = {}
    
    // Map P&L accounts to cash summary categories
    const expenseMapping = {
      'Accounting Fees': CashSummaryAccountCategory.ACCOUNTING,
      'Advertising': CashSummaryAccountCategory.AMAZON_ADVERTISING_COSTS,
      'Amazon Fees': CashSummaryAccountCategory.AMAZON_FBA_FEES,
      'Merchant Fees': CashSummaryAccountCategory.AMAZON_SELLER_FEES,
      'Storage': CashSummaryAccountCategory.AMAZON_STORAGE_FEES,
      'Bank Fees': CashSummaryAccountCategory.BANK_FEES,
      'Contractors': CashSummaryAccountCategory.CONTRACT_SALARIES,
      'Director Remuneration': CashSummaryAccountCategory.DIRECTORS_REMUNERATION,
      'Computer Expenses': CashSummaryAccountCategory.IT_SOFTWARE,
      'Freight & Courier': CashSummaryAccountCategory.LAND_FREIGHT,
      'Legal expenses': CashSummaryAccountCategory.LEGAL_AND_COMPLIANCE,
      'Cost of Goods Sold': CashSummaryAccountCategory.LMB_COST_OF_GOODS_SOLD,
      'Office Expenses': CashSummaryAccountCategory.OFFICE_SUPPLIES,
      'Telephone & Internet': CashSummaryAccountCategory.TELEPHONE_INTERNET,
      'Travel': CashSummaryAccountCategory.TRAVEL
    }

    // Process expense accounts from P&L
    if (profitLoss?.expenses?.byAccount) {
      for (const account of profitLoss.expenses.byAccount) {
        const mappedCategory = this.mapAccountToCategory(account.accountName, expenseMapping)
        if (mappedCategory) {
          items[mappedCategory] = account.total || 0
        }
      }
    }

    return items
  }

  /**
   * Map account names to cash summary categories
   */
  private static mapAccountToCategory(
    accountName: string, 
    mapping: Record<string, string>
  ): string | null {
    const normalizedName = accountName.toLowerCase()
    
    for (const [key, category] of Object.entries(mapping)) {
      if (normalizedName.includes(key.toLowerCase())) {
        return category
      }
    }
    
    return null
  }

  /**
   * Extract VAT movements from journals and transactions
   */
  private static extractVATMovements(
    journals: any[], 
    transactions: any[], 
    period: string
  ): Record<string, number> {
    let vatCollected = 0
    let vatPaid = 0

    // Process journals for VAT entries
    for (const journal of journals) {
      if (journal.journalLines) {
        for (const line of journal.journalLines) {
          const accountName = line.accountName?.toLowerCase() || ''
          
          if (accountName.includes('vat') || accountName.includes('gst')) {
            if (line.credit) {
              vatCollected += line.credit
            } else if (line.debit) {
              vatPaid += line.debit
            }
          }
        }
      }
    }

    // Process bank transactions for VAT payments
    for (const transaction of transactions) {
      if (transaction.type === 'SPEND' && transaction.reference?.toLowerCase().includes('vat')) {
        vatPaid += Math.abs(transaction.total || 0)
      }
    }

    return {
      [CashSummaryAccountCategory.VAT_COLLECTED]: vatCollected,
      [CashSummaryAccountCategory.VAT_PAID]: -vatPaid
    }
  }

  /**
   * Extract fixed asset movements
   */
  private static extractAssetMovements(
    balanceSheet: any, 
    period: string
  ): Record<string, number> {
    // Look for changes in fixed assets
    let fixedAssetMovement = 0

    if (balanceSheet?.assets?.fixed?.byAccount) {
      for (const account of balanceSheet.assets.fixed.byAccount) {
        // This would need to compare with previous period
        // For now, we'll use the current balance as a placeholder
        fixedAssetMovement += account.total || 0
      }
    }

    return {
      [CashSummaryAccountCategory.FIXED_ASSETS]: fixedAssetMovement
    }
  }

  /**
   * Calculate currency movements
   */
  private static calculateCurrencyMovements(
    transactions: any[], 
    period: string
  ): Record<string, number> {
    let currencyGains = 0

    // Look for FX gains/losses in transactions
    for (const transaction of transactions) {
      if (transaction.currencyRate && transaction.currencyRate !== 1) {
        // Calculate implied FX gain/loss
        const baseAmount = transaction.total || 0
        const foreignAmount = baseAmount * (transaction.currencyRate || 1)
        const difference = foreignAmount - baseAmount
        
        currencyGains += difference
      }
    }

    return {
      [CashSummaryAccountCategory.REALISED_CURRENCY_GAINS]: currencyGains
    }
  }

  /**
   * Extract cash balances from balance sheet
   */
  private static extractCashBalances(
    balanceSheet: any, 
    period: string
  ): Record<string, number> {
    let totalCash = 0

    // Sum all bank and cash accounts
    if (balanceSheet?.assets?.current?.byAccount) {
      for (const account of balanceSheet.assets.current.byAccount) {
        if (account.accountType === 'BANK' || account.accountName?.toLowerCase().includes('cash')) {
          totalCash += account.total || 0
        }
      }
    }

    return {
      balance: totalCash
    }
  }

  /**
   * Create empty period data structure
   */
  private static createEmptyPeriodData(periodLabel: string) {
    return {
      period: periodLabel,
      income: {},
      expenses: {},
      vatMovements: {},
      assetMovements: {},
      currencyMovements: {},
      cashBalances: { balance: 0 }
    }
  }

  /**
   * Combine all period data into final cash summary structure
   */
  private static combinePeriodData(
    periodData: any[],
    companyName: string
  ): CashSummaryData {
    const periods = periodData.map(p => p.period)
    
    // Initialize sections
    const sections: any = {
      income: this.createSection('Income', periodData, 'income'),
      expenses: this.createSection('Less Expenses', periodData, 'expenses'),
      otherCashMovements: this.createSection('Plus Other Cash Movements', periodData, 'assetMovements'),
      vatMovements: this.createSection('Plus VAT Movements', periodData, 'vatMovements'),
      foreignCurrency: this.createSection('Plus Foreign Currency Gains and Losses', periodData, 'currencyMovements')
    }

    // Calculate summary values
    const summary = this.calculateSummary(sections, periodData)

    return {
      reportTitle: 'Cash Summary',
      companyName,
      reportPeriod: `For the month ended ${periods[periods.length - 1]}`,
      periods,
      sections,
      summary,
      metadata: {
        generatedAt: new Date()
      }
    }
  }

  /**
   * Create a section from period data
   */
  private static createSection(
    title: string,
    periodData: any[],
    dataKey: string
  ): CashSummarySection {
    const items: CashSummaryLineItem[] = []
    const accountTotals: Record<string, CashSummaryLineItem> = {}

    // Collect all unique accounts
    const allAccounts = new Set<string>()
    periodData.forEach(period => {
      Object.keys(period[dataKey] || {}).forEach(account => allAccounts.add(account))
    })

    // Create line items for each account
    allAccounts.forEach(account => {
      const amounts: Record<string, number> = {}
      
      periodData.forEach(period => {
        amounts[period.period] = period[dataKey][account] || 0
      })

      const lineItem: CashSummaryLineItem = {
        account,
        amounts
      }

      items.push(lineItem)
      accountTotals[account] = lineItem
    })

    // Calculate section total
    const totalAmounts: Record<string, number> = {}
    periodData.forEach(period => {
      totalAmounts[period.period] = Object.values(period[dataKey] || {})
        .reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0)
    })

    const total: CashSummaryLineItem = {
      account: `Total ${title}`,
      amounts: totalAmounts
    }

    return {
      title,
      items,
      total
    }
  }

  /**
   * Calculate summary values
   */
  private static calculateSummary(sections: any, periodData: any[]) {
    const summary: any = {}

    // Calculate surplus/deficit for each period
    const surplusDeficitAmounts: Record<string, number> = {}
    periodData.forEach((period, index) => {
      const income = sections.income.total.amounts[period.period] || 0
      const expenses = sections.expenses.total.amounts[period.period] || 0
      surplusDeficitAmounts[period.period] = income - expenses
    })

    summary.surplusDeficit = {
      account: 'Surplus (Deficit)',
      amounts: surplusDeficitAmounts
    }

    // Calculate net cash movement
    const netCashMovementAmounts: Record<string, number> = {}
    periodData.forEach(period => {
      const surplus = surplusDeficitAmounts[period.period] || 0
      const otherCash = sections.otherCashMovements.total.amounts[period.period] || 0
      const vat = sections.vatMovements.total.amounts[period.period] || 0
      const currency = sections.foreignCurrency.total.amounts[period.period] || 0
      
      netCashMovementAmounts[period.period] = surplus + otherCash + vat + currency
    })

    summary.netCashMovement = {
      account: 'Net Cash Movement',
      amounts: netCashMovementAmounts
    }

    // Opening and closing balances
    const openingBalanceAmounts: Record<string, number> = {}
    const closingBalanceAmounts: Record<string, number> = {}
    
    periodData.forEach((period, index) => {
      if (index === 0) {
        // First period - we need to calculate opening balance
        openingBalanceAmounts[period.period] = period.cashBalances.balance - (netCashMovementAmounts[period.period] || 0)
      } else {
        // Use previous period's closing balance
        openingBalanceAmounts[period.period] = closingBalanceAmounts[periodData[index - 1].period] || 0
      }
      
      closingBalanceAmounts[period.period] = period.cashBalances.balance
    })

    summary.openingBalance = {
      account: 'Opening Balance',
      amounts: openingBalanceAmounts
    }

    summary.closingBalance = {
      account: 'Cash Balance',
      amounts: closingBalanceAmounts
    }

    // Currency adjustments (difference between expected and actual closing balance)
    const currencyAdjustmentAmounts: Record<string, number> = {}
    periodData.forEach(period => {
      const expected = (openingBalanceAmounts[period.period] || 0) + (netCashMovementAmounts[period.period] || 0)
      const actual = closingBalanceAmounts[period.period] || 0
      currencyAdjustmentAmounts[period.period] = actual - expected
    })

    summary.currencyAdjustment = {
      account: 'Currency Adjustment',
      amounts: currencyAdjustmentAmounts
    }

    return summary
  }
}