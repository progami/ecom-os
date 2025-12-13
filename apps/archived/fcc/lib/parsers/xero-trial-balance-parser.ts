import { structuredLogger } from '@/lib/logger'

interface ParsedTrialBalanceAccount {
  code: string
  name: string
  accountType?: string
  debit: number
  credit: number
  balance: number
  ytdMovement?: number
}

interface TrialBalanceStructure {
  accounts: ParsedTrialBalanceAccount[]
  totals: {
    totalDebits: number
    totalCredits: number
    balanceDifference: number
    isBalanced: boolean
  }
}

export class XeroTrialBalanceParser {
  /**
   * Parse Xero Trial Balance data
   * Handles both CSV format and pre-formatted object data
   */
  static parse(data: string[][] | any[]): TrialBalanceStructure {
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
    
    // Check for typical trial balance object properties
    const hasAccountProperties = 'accountName' in firstItem || 'name' in firstItem || 'Account' in firstItem || 'accountCode' in firstItem
    const hasBalanceProperties = 'debit' in firstItem || 'credit' in firstItem || 'balance' in firstItem || 'Debit' in firstItem || 'Credit' in firstItem
    
    return hasAccountProperties || hasBalanceProperties
  }

  /**
   * Parse pre-formatted object data
   */
  private static parsePreformattedData(data: any[]): TrialBalanceStructure {
    const result: TrialBalanceStructure = {
      accounts: [],
      totals: {
        totalDebits: 0,
        totalCredits: 0,
        balanceDifference: 0,
        isBalanced: false
      }
    }

    for (const item of data) {
      const accountName = (item.accountName || item.name || item.Account || '').toString().trim()
      const accountCode = (item.accountCode || item.code || item.Code || item.AccountCode || '').toString().trim()
      const accountType = (item.accountType || item.type || item.Type || item.AccountType || '').toString().trim()
      
      const debit = this.parseAmount((item.debit || item.Debit || '0').toString())
      const credit = this.parseAmount((item.credit || item.Credit || '0').toString())
      let balance = this.parseAmount((item.balance || item.Balance || '0').toString())
      
      if (!accountName) continue

      // Calculate balance if not provided
      if (balance === 0 && (debit > 0 || credit > 0)) {
        balance = debit - credit
      }

      const account: ParsedTrialBalanceAccount = {
        code: accountCode || `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: accountName,
        accountType: accountType,
        debit: debit,
        credit: credit,
        balance: balance,
        ytdMovement: this.parseAmount((item.ytdMovement || item.YTDMovement || '0').toString())
      }

      result.accounts.push(account)
      result.totals.totalDebits += debit
      result.totals.totalCredits += credit
    }

    // Calculate balance difference
    result.totals.balanceDifference = Math.abs(result.totals.totalDebits - result.totals.totalCredits)
    result.totals.isBalanced = result.totals.balanceDifference < 0.01 // Allow for small rounding differences

    structuredLogger.info('[XeroTrialBalanceParser] Parsed pre-formatted trial balance data', {
      accountCount: result.accounts.length,
      totalDebits: result.totals.totalDebits,
      totalCredits: result.totals.totalCredits,
      isBalanced: result.totals.isBalanced
    })

    return result
  }

  /**
   * Parse Xero Trial Balance CSV format
   * Handles various column layouts and account structures
   */
  private static parseCSVData(csvData: string[][]): TrialBalanceStructure {
    const result: TrialBalanceStructure = {
      accounts: [],
      totals: {
        totalDebits: 0,
        totalCredits: 0,
        balanceDifference: 0,
        isBalanced: false
      }
    }

    // Find header row
    let headerRowIndex = -1
    let headers: string[] = []
    
    for (let i = 0; i < Math.min(10, csvData.length); i++) {
      const row = csvData[i]
      if (row && row.length > 0) {
        // Check if this row contains header-like values
        const hasAccountHeader = row.some(cell => 
          cell && (cell.toLowerCase().includes('account') || 
                   cell.toLowerCase().includes('description'))
        )
        const hasAmountHeader = row.some(cell => 
          cell && (cell.toLowerCase().includes('debit') || 
                   cell.toLowerCase().includes('credit') ||
                   cell.toLowerCase().includes('balance'))
        )
        
        if (hasAccountHeader && hasAmountHeader) {
          headerRowIndex = i
          headers = row.map(h => (h || '').toLowerCase().trim())
          break
        }
      }
    }

    if (headerRowIndex === -1) {
      structuredLogger.warn('[XeroTrialBalanceParser] Could not find header row')
      return result
    }

    // Identify column indices
    const columnMap = this.identifyColumns(headers)
    
    // Parse data rows
    for (let i = headerRowIndex + 1; i < csvData.length; i++) {
      const row = csvData[i]
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue
      }

      // Skip total rows
      const firstCell = (row[0] || '').trim().toLowerCase()
      if (firstCell.includes('total') || firstCell.includes('net movement')) {
        continue
      }

      const account = this.parseAccountRow(row, columnMap)
      if (account && (account.debit > 0 || account.credit > 0 || account.balance !== 0)) {
        result.accounts.push(account)
        result.totals.totalDebits += account.debit
        result.totals.totalCredits += account.credit
      }
    }

    // Calculate balance difference
    result.totals.balanceDifference = Math.abs(result.totals.totalDebits - result.totals.totalCredits)
    result.totals.isBalanced = result.totals.balanceDifference < 0.01 // Allow for small rounding differences

    structuredLogger.info('[XeroTrialBalanceParser] Parsed trial balance', {
      accountCount: result.accounts.length,
      totalDebits: result.totals.totalDebits,
      totalCredits: result.totals.totalCredits,
      isBalanced: result.totals.isBalanced
    })

    return result
  }

  private static identifyColumns(headers: string[]): Record<string, number> {
    const columnMap: Record<string, number> = {
      code: -1,
      name: -1,
      type: -1,
      debit: -1,
      credit: -1,
      balance: -1,
      ytdMovement: -1
    }

    headers.forEach((header, index) => {
      if (header.includes('code') || header.includes('number')) {
        columnMap.code = index
      } else if (header.includes('name') || header.includes('description') || header === 'account') {
        columnMap.name = index
      } else if (header.includes('type') || header.includes('category')) {
        columnMap.type = index
      } else if (header.includes('debit') || header === 'dr') {
        columnMap.debit = index
      } else if (header.includes('credit') || header === 'cr') {
        columnMap.credit = index
      } else if (header.includes('ytd') || header.includes('movement')) {
        columnMap.ytdMovement = index
      } else if (header.includes('balance') || header.includes('net')) {
        columnMap.balance = index
      }
    })

    // If no separate debit/credit columns, the balance column might contain both
    if (columnMap.debit === -1 && columnMap.credit === -1 && columnMap.balance !== -1) {
      // We'll handle this in parseAccountRow
    }

    return columnMap
  }

  private static parseAccountRow(row: string[], columnMap: Record<string, number>): ParsedTrialBalanceAccount | null {
    // Extract account code and name
    let code = ''
    let name = ''
    
    if (columnMap.code !== -1 && row[columnMap.code]) {
      code = row[columnMap.code].trim()
    }
    
    if (columnMap.name !== -1 && row[columnMap.name]) {
      name = row[columnMap.name].trim()
    } else if (!code && row[0]) {
      // If no name column identified, use first non-empty column
      name = row[0].trim()
    }

    // If still no name, try to find it
    if (!name) {
      for (let i = 0; i < row.length; i++) {
        const cell = row[i]
        if (cell && cell.trim() && !this.isNumeric(cell)) {
          name = cell.trim()
          break
        }
      }
    }

    if (!name) return null

    // Extract account type
    let accountType = ''
    if (columnMap.type !== -1 && row[columnMap.type]) {
      accountType = row[columnMap.type].trim()
    }

    // Extract amounts
    let debit = 0
    let credit = 0
    let balance = 0

    if (columnMap.debit !== -1 && row[columnMap.debit]) {
      debit = this.parseAmount(row[columnMap.debit])
    }

    if (columnMap.credit !== -1 && row[columnMap.credit]) {
      credit = this.parseAmount(row[columnMap.credit])
    }

    if (columnMap.balance !== -1 && row[columnMap.balance]) {
      balance = this.parseAmount(row[columnMap.balance])
      
      // If no separate debit/credit columns, use balance
      if (columnMap.debit === -1 && columnMap.credit === -1) {
        if (balance > 0) {
          debit = balance
        } else if (balance < 0) {
          credit = Math.abs(balance)
        }
      }
    }

    // Extract YTD movement if available
    let ytdMovement = 0
    if (columnMap.ytdMovement !== -1 && row[columnMap.ytdMovement]) {
      ytdMovement = this.parseAmount(row[columnMap.ytdMovement])
    }

    // Calculate balance if not provided
    if (balance === 0 && (debit > 0 || credit > 0)) {
      balance = debit - credit
    }

    return {
      code: code || `ACC-${Date.now()}`,
      name,
      accountType,
      debit,
      credit,
      balance,
      ytdMovement
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
  static toImportFormat(parsed: TrialBalanceStructure, reportDate: Date) {
    // Group accounts by type
    const accountsByType: Record<string, any[]> = {}
    
    parsed.accounts.forEach(account => {
      const type = account.accountType || 'Unknown'
      if (!accountsByType[type]) {
        accountsByType[type] = []
      }
      accountsByType[type].push({
        accountId: account.code,
        accountCode: account.code,
        accountName: account.name,
        accountType: type,
        debit: account.debit,
        credit: account.credit,
        balance: account.balance,
        isActive: true
      })
    })

    // Create summary by account type
    const accountTypes = Object.entries(accountsByType).map(([type, accounts]) => {
      const typeDebits = accounts.reduce((sum, acc) => sum + acc.debit, 0)
      const typeCredits = accounts.reduce((sum, acc) => sum + acc.credit, 0)
      return {
        type,
        debits: typeDebits,
        credits: typeCredits,
        count: accounts.length
      }
    })

    // Calculate largest debit and credit
    let largestDebit = 0
    let largestCredit = 0
    
    parsed.accounts.forEach(account => {
      if (account.debit > largestDebit) largestDebit = account.debit
      if (account.credit > largestCredit) largestCredit = account.credit
    })

    return {
      accounts: Object.values(accountsByType).flat(),
      totals: parsed.totals,
      summary: {
        totalAccounts: parsed.accounts.length,
        activeAccounts: parsed.accounts.length,
        inactiveAccounts: 0,
        largestDebit,
        largestCredit
      },
      accountTypes,
      reportDate: reportDate.toISOString(),
      source: 'import',
      fetchedAt: new Date().toISOString()
    }
  }
}