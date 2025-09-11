// JournalEntryService.ts - Proper double-entry bookkeeping implementation

import { CHART_OF_ACCOUNTS, getAccount } from '@/lib/chart-of-accounts'
import SystemConfigService from '@/services/database/SystemConfigService'

export interface JournalLine {
  accountCode: string
  accountName?: string
  debit: number
  credit: number
  description?: string
}

export interface JournalEntry {
  id?: string
  date: Date
  description: string
  reference?: string
  lines: JournalLine[]
  isPosted: boolean
  createdAt?: Date
  postedAt?: Date
}

export class JournalEntryService {
  private entries: JournalEntry[] = []
  private accountBalances: Map<string, number> = new Map()
  private configService: SystemConfigService
  private glAccountCodes: any = {}

  constructor() {
    this.configService = SystemConfigService.getInstance()
    // Initialize all account balances to zero
    Object.keys(CHART_OF_ACCOUNTS).forEach(code => {
      this.accountBalances.set(code, 0)
    })
    this.loadAccountCodes()
  }

  private async loadAccountCodes() {
    try {
      this.glAccountCodes = await this.configService.getGLAccountCodes()
    } catch (error) {
      console.error('Failed to load GL account codes:', error)
      // Fallback to hardcoded values if needed
    }
  }

  /**
   * Create a new journal entry
   */
  createEntry(
    date: Date,
    description: string,
    lines: JournalLine[],
    reference?: string
  ): JournalEntry {
    // Validate that the entry balances
    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0)
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(`Journal entry does not balance. Debits: ${totalDebits}, Credits: ${totalCredits}`)
    }

    // Validate all account codes exist
    lines.forEach(line => {
      const account = getAccount(line.accountCode)
      if (!account) {
        throw new Error(`Invalid account code: ${line.accountCode}`)
      }
      // Add account name for clarity
      line.accountName = account.name
    })

    const entry: JournalEntry = {
      id: `JE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date,
      description,
      reference,
      lines,
      isPosted: false,
      createdAt: new Date()
    }

    this.entries.push(entry)
    return entry
  }

  /**
   * Post a journal entry to update account balances
   */
  postEntry(entryId: string): void {
    const entry = this.entries.find(e => e.id === entryId)
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`)
    }

    if (entry.isPosted) {
      throw new Error(`Journal entry ${entryId} has already been posted`)
    }

    // Update account balances
    entry.lines.forEach(line => {
      const account = getAccount(line.accountCode)
      if (!account) return

      const currentBalance = this.accountBalances.get(line.accountCode) || 0
      let newBalance = currentBalance

      // Apply debit/credit based on normal balance
      if (account.normalBalance === 'Debit') {
        newBalance += line.debit - line.credit
      } else {
        newBalance += line.credit - line.debit
      }

      this.accountBalances.set(line.accountCode, newBalance)
    })

    entry.isPosted = true
    entry.postedAt = new Date()
  }

  /**
   * Create common journal entries
   */
  
  // When cash is received (e.g., investment)
  recordCashReceipt(date: Date, amount: number, description: string, source: 'investment' | 'revenue' | 'loan'): JournalEntry {
    const lines: JournalLine[] = [
      { accountCode: this.glAccountCodes.CASH?.code || '11000', debit: amount, credit: 0 } // Cash
    ]

    switch (source) {
      case 'investment':
        lines.push({ accountCode: this.glAccountCodes.MEMBER_INVESTMENT?.code || '31000', debit: 0, credit: amount }) // Member Investment
        break
      case 'revenue':
        lines.push({ accountCode: this.glAccountCodes.AMAZON_SALES?.code || '40100', debit: 0, credit: amount }) // Amazon Sales
        break
      case 'loan':
        lines.push({ accountCode: this.glAccountCodes.MEMBERS_LOAN_ACCOUNT?.code || '24000', debit: 0, credit: amount }) // Members Loan Account
        break
    }

    return this.createEntry(date, description, lines)
  }

  // When paying expenses
  recordExpensePayment(date: Date, expenseCode: string, amount: number, description: string): JournalEntry {
    const lines: JournalLine[] = [
      { accountCode: expenseCode, debit: amount, credit: 0 }, // Expense
      { accountCode: this.glAccountCodes.CASH?.code || '11000', debit: 0, credit: amount } // Cash
    ]

    return this.createEntry(date, description, lines)
  }

  // When accruing payroll
  recordPayrollAccrual(date: Date, grossPayroll: number, employeeTaxes: number, employerTaxes: number): JournalEntry {
    const netPay = grossPayroll - employeeTaxes
    
    const lines: JournalLine[] = [
      // Debit expenses
      { accountCode: this.glAccountCodes.PAYROLL?.code || '51000', debit: grossPayroll, credit: 0 }, // Salary Expense
      { accountCode: this.glAccountCodes.PAYROLL_TAX?.code || '51100', debit: employerTaxes, credit: 0 }, // Employer Tax Expense
      
      // Credit liabilities
      { accountCode: this.glAccountCodes.PAYROLL_PAYABLE?.code || '21200', debit: 0, credit: netPay }, // Payroll Payable (net to employees)
      { accountCode: this.glAccountCodes.PAYROLL_TAX_PAYABLE?.code || '21300', debit: 0, credit: employeeTaxes + employerTaxes } // Payroll Tax Payable
    ]

    return this.createEntry(date, 'Payroll Accrual', lines)
  }

  // When paying payroll
  recordPayrollPayment(date: Date, netPay: number, payrollTaxes: number): JournalEntry {
    const lines: JournalLine[] = [
      // Clear liabilities
      { accountCode: this.glAccountCodes.PAYROLL_PAYABLE?.code || '21200', debit: netPay, credit: 0 }, // Payroll Payable
      { accountCode: this.glAccountCodes.PAYROLL_TAX_PAYABLE?.code || '21300', debit: payrollTaxes, credit: 0 }, // Payroll Tax Payable
      
      // Credit cash
      { accountCode: this.glAccountCodes.CASH?.code || '11000', debit: 0, credit: netPay + payrollTaxes } // Cash
    ]

    return this.createEntry(date, 'Payroll Payment', lines)
  }

  // When purchasing inventory on credit
  recordInventoryPurchase(date: Date, amount: number, description: string, onCredit: boolean = true): JournalEntry {
    const lines: JournalLine[] = [
      { accountCode: this.glAccountCodes.INVENTORY?.code || '13000', debit: amount, credit: 0 } // Inventory
    ]

    if (onCredit) {
      lines.push({ accountCode: this.glAccountCodes.ACCOUNTS_PAYABLE?.code || '21000', debit: 0, credit: amount }) // Accounts Payable
    } else {
      lines.push({ accountCode: this.glAccountCodes.CASH?.code || '11000', debit: 0, credit: amount }) // Cash
    }

    return this.createEntry(date, description, lines)
  }

  // When making a sale (Amazon)
  recordAmazonSale(date: Date, grossRevenue: number, amazonFees: number, netRevenue: number): JournalEntry {
    const lines: JournalLine[] = [
      // Debit receivables for net amount
      { accountCode: this.glAccountCodes.AMAZON_RECEIVABLE?.code || '11300', debit: netRevenue, credit: 0 }, // Amazon Receivable
      
      // Debit fees
      { accountCode: this.glAccountCodes.AMAZON_SELLER_FEES?.code || '50100', debit: amazonFees, credit: 0 }, // Amazon Seller Fees
      
      // Credit revenue for gross amount
      { accountCode: this.glAccountCodes.AMAZON_SALES?.code || '40100', debit: 0, credit: grossRevenue } // Amazon Sales
    ]

    return this.createEntry(date, 'Amazon Sale', lines)
  }

  // When Amazon settles payment
  recordAmazonSettlement(date: Date, amount: number): JournalEntry {
    const lines: JournalLine[] = [
      { accountCode: this.glAccountCodes.CASH?.code || '11000', debit: amount, credit: 0 }, // Cash
      { accountCode: this.glAccountCodes.AMAZON_RECEIVABLE?.code || '11300', debit: 0, credit: amount } // Amazon Receivable
    ]

    return this.createEntry(date, 'Amazon Settlement', lines)
  }

  // Get account balance
  getAccountBalance(accountCode: string): number {
    return this.accountBalances.get(accountCode) || 0
  }

  // Get all journal entries
  getEntries(startDate?: Date, endDate?: Date): JournalEntry[] {
    let filtered = this.entries

    if (startDate) {
      filtered = filtered.filter(e => e.date >= startDate)
    }

    if (endDate) {
      filtered = filtered.filter(e => e.date <= endDate)
    }

    return filtered.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  // Generate trial balance
  getTrialBalance(): { accountCode: string; accountName: string; debit: number; credit: number }[] {
    const trialBalance: { accountCode: string; accountName: string; debit: number; credit: number }[] = []

    this.accountBalances.forEach((balance, code) => {
      if (balance === 0) return

      const account = getAccount(code)
      if (!account) return

      trialBalance.push({
        accountCode: code,
        accountName: account.name,
        debit: balance > 0 && account.normalBalance === 'Debit' ? balance : 0,
        credit: balance > 0 && account.normalBalance === 'Credit' ? balance : 0
      })
    })

    return trialBalance.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  }

  // Validate trial balance
  validateTrialBalance(): { isValid: boolean; totalDebits: number; totalCredits: number; difference: number } {
    const trialBalance = this.getTrialBalance()
    const totalDebits = trialBalance.reduce((sum, row) => sum + row.debit, 0)
    const totalCredits = trialBalance.reduce((sum, row) => sum + row.credit, 0)
    const difference = Math.abs(totalDebits - totalCredits)

    return {
      isValid: difference < 0.01,
      totalDebits,
      totalCredits,
      difference
    }
  }
}

export default JournalEntryService