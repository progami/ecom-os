import { structuredLogger } from '@/lib/logger'

interface ParsedIncomeExpense {
  name: string
  code?: string
  amount: number
  isSubTotal?: boolean
  parentCategory?: string
}

interface ProfitLossStructure {
  income: {
    categories: ParsedIncomeExpense[]
    totalIncome: number
  }
  costOfSales: {
    categories: ParsedIncomeExpense[]
    totalCostOfSales: number
  }
  expenses: {
    categories: ParsedIncomeExpense[]
    totalExpenses: number
  }
  otherIncome: {
    categories: ParsedIncomeExpense[]
    totalOtherIncome: number
  }
  otherExpenses: {
    categories: ParsedIncomeExpense[]
    totalOtherExpenses: number
  }
  grossProfit: number
  netProfit: number
}

export class XeroProfitLossParser {
  /**
   * Parse Xero Profit & Loss data
   * Handles both CSV format and pre-formatted object data
   */
  static parse(data: string[][] | any[]): ProfitLossStructure {
    // Check if data is pre-formatted objects
    if (this.isPreformattedData(data)) {
      return this.parsePreformattedData(data as any[])
    }
    
    // Otherwise parse as CSV
    return this.parseCSVData(data as string[][])
  }

  /**
   * Check if data is pre-formatted objects rather than CSV arrays
   */
  private static isPreformattedData(data: any): boolean {
    if (!Array.isArray(data) || data.length === 0) return false
    
    const firstItem = data[0]
    if (typeof firstItem !== 'object' || Array.isArray(firstItem)) return false
    
    // Check for typical profit & loss object properties
    const hasAccountProperties = 'accountName' in firstItem || 'name' in firstItem || 'Account' in firstItem
    const hasAmountProperties = 'amount' in firstItem || 'value' in firstItem || 'total' in firstItem || 'Amount' in firstItem
    
    return hasAccountProperties || hasAmountProperties
  }

  /**
   * Parse pre-formatted object data
   */
  private static parsePreformattedData(data: any[]): ProfitLossStructure {
    const result: ProfitLossStructure = {
      income: {
        categories: [],
        totalIncome: 0
      },
      costOfSales: {
        categories: [],
        totalCostOfSales: 0
      },
      expenses: {
        categories: [],
        totalExpenses: 0
      },
      otherIncome: {
        categories: [],
        totalOtherIncome: 0
      },
      otherExpenses: {
        categories: [],
        totalOtherExpenses: 0
      },
      grossProfit: 0,
      netProfit: 0
    }

    for (const item of data) {
      const accountName = (item.accountName || item.name || item.Account || '').toString().trim()
      const amount = this.parseAmount((item.amount || item.value || item.total || item.Amount || '0').toString())
      const accountType = (item.accountType || item.type || item.Type || '').toString().toLowerCase()
      const accountClass = (item.accountClass || item.class || item.Class || '').toString().toLowerCase()
      
      if (!accountName) continue

      const account: ParsedIncomeExpense = {
        name: accountName,
        code: item.accountCode || item.code || item.Code,
        amount: amount
      }

      // Categorize based on account name, type, or class
      if (accountName.toLowerCase().includes('gross profit') || accountName.toLowerCase().includes('gross margin')) {
        result.grossProfit = amount
      } else if (accountName.toLowerCase().includes('net profit') || accountName.toLowerCase().includes('net income') || accountName.toLowerCase().includes('net loss')) {
        result.netProfit = amount
      } else if (accountType.includes('revenue') || accountType.includes('income') || accountClass.includes('revenue') || 
                 accountName.toLowerCase().includes('sales') || accountName.toLowerCase().includes('revenue')) {
        if (accountName.toLowerCase().includes('other income')) {
          result.otherIncome.categories.push(account)
          result.otherIncome.totalOtherIncome += amount
        } else {
          result.income.categories.push(account)
          result.income.totalIncome += amount
        }
      } else if (accountType.includes('cost of sales') || accountType.includes('cogs') || accountClass.includes('cost of sales') ||
                 accountName.toLowerCase().includes('cost of sales') || accountName.toLowerCase().includes('cost of goods')) {
        result.costOfSales.categories.push(account)
        result.costOfSales.totalCostOfSales += amount
      } else if (accountType.includes('expense') || accountClass.includes('expense')) {
        if (accountName.toLowerCase().includes('other expense')) {
          result.otherExpenses.categories.push(account)
          result.otherExpenses.totalOtherExpenses += amount
        } else {
          result.expenses.categories.push(account)
          result.expenses.totalExpenses += amount
        }
      } else if (accountName.toLowerCase().includes('expense')) {
        // Fallback for expense categorization based on name
        if (accountName.toLowerCase().includes('other expense')) {
          result.otherExpenses.categories.push(account)
          result.otherExpenses.totalOtherExpenses += amount
        } else {
          result.expenses.categories.push(account)
          result.expenses.totalExpenses += amount
        }
      }
    }

    // Calculate missing totals
    if (result.grossProfit === 0) {
      result.grossProfit = result.income.totalIncome - result.costOfSales.totalCostOfSales
    }
    if (result.netProfit === 0) {
      result.netProfit = result.grossProfit - result.expenses.totalExpenses + 
                         result.otherIncome.totalOtherIncome - result.otherExpenses.totalOtherExpenses
    }

    structuredLogger.info('[XeroProfitLossParser] Parsed pre-formatted profit & loss data', {
      totalIncome: result.income.totalIncome,
      totalExpenses: result.expenses.totalExpenses + result.costOfSales.totalCostOfSales,
      netProfit: result.netProfit,
      accountCounts: {
        income: result.income.categories.length,
        costOfSales: result.costOfSales.categories.length,
        expenses: result.expenses.categories.length
      }
    })

    return result
  }

  /**
   * Parse Xero Profit & Loss CSV format
   * Handles hierarchical structure with categories and subtotals
   */
  private static parseCSVData(csvData: string[][]): ProfitLossStructure {
    const result: ProfitLossStructure = {
      income: {
        categories: [],
        totalIncome: 0
      },
      costOfSales: {
        categories: [],
        totalCostOfSales: 0
      },
      expenses: {
        categories: [],
        totalExpenses: 0
      },
      otherIncome: {
        categories: [],
        totalOtherIncome: 0
      },
      otherExpenses: {
        categories: [],
        totalOtherExpenses: 0
      },
      grossProfit: 0,
      netProfit: 0
    }

    let currentSection = ''
    let currentSubSection = ''
    let skipRows = 0

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i]
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue
      }

      // Skip header rows
      if (skipRows > 0) {
        skipRows--
        continue
      }

      const firstCell = (row[0] || '').trim()
      const lastCell = row[row.length - 1] || ''
      
      // Identify main sections
      if (firstCell === 'Income' || firstCell === 'Revenue' || firstCell === 'Sales') {
        currentSection = 'income'
        currentSubSection = ''
        continue
      } else if (firstCell === 'Cost of Sales' || firstCell === 'Cost of Goods Sold') {
        currentSection = 'cost-of-sales'
        currentSubSection = ''
        continue
      } else if (firstCell === 'Operating Expenses' || firstCell === 'Expenses') {
        currentSection = 'expenses'
        currentSubSection = ''
        continue
      } else if (firstCell === 'Other Income') {
        currentSection = 'other-income'
        currentSubSection = ''
        continue
      } else if (firstCell === 'Other Expenses') {
        currentSection = 'other-expenses'
        currentSubSection = ''
        continue
      }

      // Handle subsections
      if (firstCell && !this.isNumeric(lastCell) && !firstCell.startsWith('Total') && 
          !firstCell.includes('Profit') && !firstCell.includes('Loss')) {
        currentSubSection = firstCell
        continue
      }

      // Parse account lines
      const account = this.parseAccountLine(row)
      if (!account) continue

      // Assign to appropriate section
      if (firstCell.startsWith('Total Income')) {
        result.income.totalIncome = account.amount
      } else if (firstCell.startsWith('Total Cost of Sales')) {
        result.costOfSales.totalCostOfSales = account.amount
      } else if (firstCell.startsWith('Total Operating Expenses') || firstCell.startsWith('Total Expenses')) {
        result.expenses.totalExpenses = account.amount
      } else if (firstCell.startsWith('Total Other Income')) {
        result.otherIncome.totalOtherIncome = account.amount
      } else if (firstCell.startsWith('Total Other Expenses')) {
        result.otherExpenses.totalOtherExpenses = account.amount
      } else if (firstCell === 'Gross Profit' || firstCell === 'Gross Margin') {
        result.grossProfit = account.amount
      } else if (firstCell === 'Net Profit' || firstCell === 'Net Income' || firstCell === 'Net Loss') {
        result.netProfit = account.amount
      } else {
        // Regular account line
        account.parentCategory = currentSubSection
        
        switch (currentSection) {
          case 'income':
            result.income.categories.push(account)
            break
          case 'cost-of-sales':
            result.costOfSales.categories.push(account)
            break
          case 'expenses':
            result.expenses.categories.push(account)
            break
          case 'other-income':
            result.otherIncome.categories.push(account)
            break
          case 'other-expenses':
            result.otherExpenses.categories.push(account)
            break
        }
      }
    }

    // Calculate missing totals
    if (result.grossProfit === 0) {
      result.grossProfit = result.income.totalIncome - result.costOfSales.totalCostOfSales
    }
    if (result.netProfit === 0) {
      result.netProfit = result.grossProfit - result.expenses.totalExpenses + 
                         result.otherIncome.totalOtherIncome - result.otherExpenses.totalOtherExpenses
    }

    structuredLogger.info('[XeroProfitLossParser] Parsed profit & loss', {
      totalIncome: result.income.totalIncome,
      totalExpenses: result.expenses.totalExpenses + result.costOfSales.totalCostOfSales,
      netProfit: result.netProfit,
      accountCounts: {
        income: result.income.categories.length,
        costOfSales: result.costOfSales.categories.length,
        expenses: result.expenses.categories.length
      }
    })

    return result
  }

  private static parseAccountLine(row: string[]): ParsedIncomeExpense | null {
    // Find the account name (first non-empty cell)
    let accountName = ''
    let nameIndex = 0
    
    for (let i = 0; i < row.length; i++) {
      if (row[i] && row[i].trim()) {
        accountName = row[i].trim()
        nameIndex = i
        break
      }
    }

    if (!accountName) return null

    // Find the amount (last numeric cell)
    let amount = 0
    for (let i = row.length - 1; i > nameIndex; i--) {
      const cellValue = row[i]
      if (cellValue && this.isNumeric(cellValue)) {
        amount = this.parseAmount(cellValue)
        break
      }
    }

    // Skip if no amount found and not a total line
    if (amount === 0 && !accountName.toLowerCase().includes('total') && 
        !accountName.toLowerCase().includes('profit') && !accountName.toLowerCase().includes('loss')) {
      return null
    }

    return {
      name: accountName,
      amount,
      isSubTotal: accountName.toLowerCase().includes('total')
    }
  }

  private static isNumeric(value: string): boolean {
    if (!value) return false
    // Remove currency symbols, commas, spaces, and [FX] markers
    const cleaned = value.replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '').trim()
    // Check for parentheses (negative numbers) or regular numbers
    return /^\(?\d+\.?\d*\)?$/.test(cleaned)
  }

  private static parseAmount(value: string): number {
    if (!value) return 0
    
    // Remove currency symbols, commas, spaces, and [FX] markers
    let cleaned = value.replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '').trim()
    
    // Handle negative values in parentheses
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1)
    }
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Convert parsed structure to database format
   */
  static toImportFormat(parsed: ProfitLossStructure, periodStart: Date, periodEnd: Date) {
    // Group revenue items
    const revenue = [{
      accountName: 'Total Revenue',
      total: parsed.income.totalIncome,
      lineItems: parsed.income.categories.map(cat => ({
        accountName: cat.name,
        amount: cat.amount
      }))
    }]

    // Group expense items (combining cost of sales and operating expenses)
    const expenses = []
    
    if (parsed.costOfSales.totalCostOfSales > 0) {
      expenses.push({
        accountName: 'Cost of Sales',
        total: parsed.costOfSales.totalCostOfSales,
        lineItems: parsed.costOfSales.categories.map(cat => ({
          accountName: cat.name,
          amount: cat.amount
        }))
      })
    }

    if (parsed.expenses.totalExpenses > 0) {
      expenses.push({
        accountName: 'Operating Expenses',
        total: parsed.expenses.totalExpenses,
        lineItems: parsed.expenses.categories.map(cat => ({
          accountName: cat.name,
          amount: cat.amount
        }))
      })
    }

    const totalExpenses = parsed.costOfSales.totalCostOfSales + parsed.expenses.totalExpenses
    const profitMargin = parsed.income.totalIncome > 0 ? 
      (parsed.netProfit / parsed.income.totalIncome) * 100 : 0

    return {
      revenue,
      expenses,
      totalRevenue: parsed.income.totalIncome,
      totalExpenses,
      grossProfit: parsed.grossProfit,
      netProfit: parsed.netProfit,
      otherIncome: parsed.otherIncome.totalOtherIncome,
      otherExpenses: parsed.otherExpenses.totalOtherExpenses,
      profitMargin,
      fromDate: periodStart.toISOString(),
      toDate: periodEnd.toISOString(),
      reportDate: periodEnd.toISOString()
    }
  }
}