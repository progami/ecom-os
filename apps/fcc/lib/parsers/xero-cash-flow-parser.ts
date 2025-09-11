import { structuredLogger } from '@/lib/logger'

interface ParsedCashFlowItem {
  name: string
  amount: number
  isSubTotal?: boolean
  parentCategory?: string
}

interface CashFlowStructure {
  operatingActivities: {
    items: ParsedCashFlowItem[]
    netCashFromOperating: number
  }
  investingActivities: {
    items: ParsedCashFlowItem[]
    netCashFromInvesting: number
  }
  financingActivities: {
    items: ParsedCashFlowItem[]
    netCashFromFinancing: number
  }
  openingBalance: number
  closingBalance: number
  netCashMovement: number
}

export class XeroCashFlowParser {
  /**
   * Parse Xero Cash Flow Statement data
   * Handles both CSV format and pre-formatted object data
   */
  static parse(data: string[][] | any[]): CashFlowStructure {
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
    
    // Check for typical cash flow object properties
    const hasAccountProperties = 'accountName' in firstItem || 'name' in firstItem || 'description' in firstItem
    const hasAmountProperties = 'amount' in firstItem || 'value' in firstItem || 'cashFlow' in firstItem
    const hasSectionProperties = 'section' in firstItem || 'category' in firstItem || 'activityType' in firstItem
    
    return hasAccountProperties || hasAmountProperties || hasSectionProperties
  }

  /**
   * Parse pre-formatted object data
   */
  private static parsePreformattedData(data: any[]): CashFlowStructure {
    const result: CashFlowStructure = {
      operatingActivities: {
        items: [],
        netCashFromOperating: 0
      },
      investingActivities: {
        items: [],
        netCashFromInvesting: 0
      },
      financingActivities: {
        items: [],
        netCashFromFinancing: 0
      },
      openingBalance: 0,
      closingBalance: 0,
      netCashMovement: 0
    }

    for (const item of data) {
      const name = (item.accountName || item.name || item.description || '').toString().trim()
      const amount = this.parseAmount((item.amount || item.value || item.cashFlow || '0').toString())
      const section = (item.section || item.category || item.activityType || '').toString().toLowerCase()
      
      if (!name) continue

      const cashFlowItem: ParsedCashFlowItem = {
        name,
        amount,
        isSubTotal: name.toLowerCase().includes('total') || name.toLowerCase().includes('net')
      }

      // Handle special items
      if (name.toLowerCase().includes('opening cash') || name.toLowerCase().includes('cash at beginning')) {
        result.openingBalance = amount
      } else if (name.toLowerCase().includes('closing cash') || name.toLowerCase().includes('cash at end')) {
        result.closingBalance = amount
      } else if (name.toLowerCase().includes('net cash movement') || name.toLowerCase().includes('net increase') || 
                 name.toLowerCase().includes('net decrease')) {
        result.netCashMovement = amount
      } else if (section.includes('operating') || name.toLowerCase().includes('operating activities')) {
        if (name.toLowerCase().includes('net cash from operating') || name.toLowerCase().includes('total operating')) {
          result.operatingActivities.netCashFromOperating = amount
        } else {
          result.operatingActivities.items.push(cashFlowItem)
        }
      } else if (section.includes('investing') || name.toLowerCase().includes('investing activities')) {
        if (name.toLowerCase().includes('net cash from investing') || name.toLowerCase().includes('total investing')) {
          result.investingActivities.netCashFromInvesting = amount
        } else {
          result.investingActivities.items.push(cashFlowItem)
        }
      } else if (section.includes('financing') || name.toLowerCase().includes('financing activities')) {
        if (name.toLowerCase().includes('net cash from financing') || name.toLowerCase().includes('total financing')) {
          result.financingActivities.netCashFromFinancing = amount
        } else {
          result.financingActivities.items.push(cashFlowItem)
        }
      } else {
        // Try to categorize based on name patterns
        if (name.toLowerCase().includes('receipt') || name.toLowerCase().includes('payment') || 
            name.toLowerCase().includes('wages') || name.toLowerCase().includes('tax')) {
          result.operatingActivities.items.push(cashFlowItem)
        } else if (name.toLowerCase().includes('asset') || name.toLowerCase().includes('investment') || 
                   name.toLowerCase().includes('purchase') || name.toLowerCase().includes('sale')) {
          result.investingActivities.items.push(cashFlowItem)
        } else if (name.toLowerCase().includes('loan') || name.toLowerCase().includes('borrow') || 
                   name.toLowerCase().includes('dividend') || name.toLowerCase().includes('equity')) {
          result.financingActivities.items.push(cashFlowItem)
        }
      }
    }

    // Calculate totals if not provided
    if (result.operatingActivities.netCashFromOperating === 0) {
      result.operatingActivities.netCashFromOperating = result.operatingActivities.items
        .reduce((sum, item) => sum + item.amount, 0)
    }
    if (result.investingActivities.netCashFromInvesting === 0) {
      result.investingActivities.netCashFromInvesting = result.investingActivities.items
        .reduce((sum, item) => sum + item.amount, 0)
    }
    if (result.financingActivities.netCashFromFinancing === 0) {
      result.financingActivities.netCashFromFinancing = result.financingActivities.items
        .reduce((sum, item) => sum + item.amount, 0)
    }

    // Calculate missing values
    if (result.netCashMovement === 0) {
      result.netCashMovement = result.operatingActivities.netCashFromOperating +
                               result.investingActivities.netCashFromInvesting +
                               result.financingActivities.netCashFromFinancing
    }

    if (result.closingBalance === 0 && result.openingBalance !== 0) {
      result.closingBalance = result.openingBalance + result.netCashMovement
    }

    structuredLogger.info('[XeroCashFlowParser] Parsed pre-formatted cash flow data', {
      operatingCashFlow: result.operatingActivities.netCashFromOperating,
      investingCashFlow: result.investingActivities.netCashFromInvesting,
      financingCashFlow: result.financingActivities.netCashFromFinancing,
      netMovement: result.netCashMovement
    })

    return result
  }

  /**
   * Parse Xero Cash Flow Statement CSV format
   * Handles various formats including direct/indirect method
   */
  private static parseCSVData(csvData: string[][]): CashFlowStructure {
    const result: CashFlowStructure = {
      operatingActivities: {
        items: [],
        netCashFromOperating: 0
      },
      investingActivities: {
        items: [],
        netCashFromInvesting: 0
      },
      financingActivities: {
        items: [],
        netCashFromFinancing: 0
      },
      openingBalance: 0,
      closingBalance: 0,
      netCashMovement: 0
    }

    let currentSection = ''
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
      if (firstCell.toLowerCase().includes('operating activities') || 
          firstCell.toLowerCase().includes('cash flows from operating')) {
        currentSection = 'operating'
        continue
      } else if (firstCell.toLowerCase().includes('investing activities') ||
                 firstCell.toLowerCase().includes('cash flows from investing')) {
        currentSection = 'investing'
        continue
      } else if (firstCell.toLowerCase().includes('financing activities') ||
                 firstCell.toLowerCase().includes('cash flows from financing')) {
        currentSection = 'financing'
        continue
      }

      // Parse line items
      const item = this.parseCashFlowLine(row)
      if (!item) continue

      // Handle special items
      if (firstCell.toLowerCase().includes('opening cash') || 
          firstCell.toLowerCase().includes('cash at beginning')) {
        result.openingBalance = item.amount
      } else if (firstCell.toLowerCase().includes('closing cash') || 
                 firstCell.toLowerCase().includes('cash at end')) {
        result.closingBalance = item.amount
      } else if (firstCell.toLowerCase().includes('net cash from operating') ||
                 firstCell.toLowerCase().includes('total operating activities')) {
        result.operatingActivities.netCashFromOperating = item.amount
      } else if (firstCell.toLowerCase().includes('net cash from investing') ||
                 firstCell.toLowerCase().includes('total investing activities')) {
        result.investingActivities.netCashFromInvesting = item.amount
      } else if (firstCell.toLowerCase().includes('net cash from financing') ||
                 firstCell.toLowerCase().includes('total financing activities')) {
        result.financingActivities.netCashFromFinancing = item.amount
      } else if (firstCell.toLowerCase().includes('net increase') || 
                 firstCell.toLowerCase().includes('net decrease') ||
                 firstCell.toLowerCase().includes('net cash movement')) {
        result.netCashMovement = item.amount
      } else {
        // Regular line item
        switch (currentSection) {
          case 'operating':
            result.operatingActivities.items.push(item)
            break
          case 'investing':
            result.investingActivities.items.push(item)
            break
          case 'financing':
            result.financingActivities.items.push(item)
            break
        }
      }
    }

    // Calculate missing values
    if (result.netCashMovement === 0) {
      result.netCashMovement = result.operatingActivities.netCashFromOperating +
                               result.investingActivities.netCashFromInvesting +
                               result.financingActivities.netCashFromFinancing
    }

    if (result.closingBalance === 0 && result.openingBalance !== 0) {
      result.closingBalance = result.openingBalance + result.netCashMovement
    }

    structuredLogger.info('[XeroCashFlowParser] Parsed cash flow statement', {
      operatingCashFlow: result.operatingActivities.netCashFromOperating,
      investingCashFlow: result.investingActivities.netCashFromInvesting,
      financingCashFlow: result.financingActivities.netCashFromFinancing,
      netMovement: result.netCashMovement
    })

    return result
  }

  private static parseCashFlowLine(row: string[]): ParsedCashFlowItem | null {
    // Find the description (first non-empty cell)
    let name = ''
    let nameIndex = 0
    
    for (let i = 0; i < row.length; i++) {
      if (row[i] && row[i].trim()) {
        name = row[i].trim()
        nameIndex = i
        break
      }
    }

    if (!name) return null

    // Find the amount (last numeric cell)
    let amount = 0
    for (let i = row.length - 1; i > nameIndex; i--) {
      const cellValue = row[i]
      if (cellValue && this.isNumeric(cellValue)) {
        amount = this.parseAmount(cellValue)
        break
      }
    }

    // Skip if no amount found and not a section header
    if (amount === 0 && !name.toLowerCase().includes('activities') && 
        !name.toLowerCase().includes('cash') && !name.toLowerCase().includes('total')) {
      return null
    }

    return {
      name,
      amount,
      isSubTotal: name.toLowerCase().includes('total') || name.toLowerCase().includes('net')
    }
  }

  private static isNumeric(value: string): boolean {
    if (!value) return false
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[£$€¥,\s]/g, '').trim()
    // Check for parentheses (negative numbers) or regular numbers
    return /^\(?\d+\.?\d*\)?$/.test(cleaned) || /^-?\d+\.?\d*$/.test(cleaned)
  }

  private static parseAmount(value: string): number {
    if (!value) return 0
    
    // Remove currency symbols, commas, spaces
    let cleaned = value.replace(/[£$€¥,\s]/g, '').trim()
    
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
  static toImportFormat(parsed: CashFlowStructure, periodStart: Date, periodEnd: Date) {
    // Extract specific common items from operating activities
    const findItem = (items: ParsedCashFlowItem[], patterns: string[]): number => {
      for (const pattern of patterns) {
        const item = items.find(i => 
          i.name.toLowerCase().includes(pattern.toLowerCase())
        )
        if (item) return item.amount
      }
      return 0
    }

    const operatingItems = parsed.operatingActivities.items
    const receiptsFromCustomers = findItem(operatingItems, ['receipts from customers', 'cash receipts', 'sales receipts'])
    const paymentsToSuppliers = findItem(operatingItems, ['payments to suppliers', 'supplier payments', 'purchases'])
    const paymentsToEmployees = findItem(operatingItems, ['payments to employees', 'wages', 'salaries'])
    const interestPaid = findItem(operatingItems, ['interest paid', 'finance costs'])
    const incomeTaxPaid = findItem(operatingItems, ['income tax', 'tax paid', 'corporation tax'])

    const investingItems = parsed.investingActivities.items
    const purchaseOfAssets = findItem(investingItems, ['purchase', 'acquisition', 'capital expenditure'])
    const saleOfAssets = findItem(investingItems, ['sale', 'disposal', 'proceeds from'])

    const financingItems = parsed.financingActivities.items
    const proceedsFromBorrowing = findItem(financingItems, ['proceeds', 'loan received', 'borrowing'])
    const repaymentOfBorrowing = findItem(financingItems, ['repayment', 'loan repayment', 'debt payment'])
    const dividendsPaid = findItem(financingItems, ['dividend', 'distribution'])

    return {
      operatingActivities: {
        netCashFromOperating: parsed.operatingActivities.netCashFromOperating,
        receiptsFromCustomers,
        paymentsToSuppliers,
        paymentsToEmployees,
        interestPaid,
        incomeTaxPaid
      },
      investingActivities: {
        netCashFromInvesting: parsed.investingActivities.netCashFromInvesting,
        purchaseOfAssets,
        saleOfAssets
      },
      financingActivities: {
        netCashFromFinancing: parsed.financingActivities.netCashFromFinancing,
        proceedsFromBorrowing,
        repaymentOfBorrowing,
        dividendsPaid
      },
      summary: {
        netCashFlow: parsed.netCashMovement,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        operatingCashFlowRatio: parsed.operatingActivities.netCashFromOperating > 0 ? 
          (parsed.operatingActivities.netCashFromOperating / parsed.closingBalance) * 100 : 0
      },
      fromDate: periodStart.toISOString(),
      toDate: periodEnd.toISOString(),
      reportDate: periodEnd.toISOString()
    }
  }
}