import { Transaction } from '@/types/v4/financial'
import { GeneralLedger } from '../engine/GeneralLedger'

export interface BalanceSheetAccounts {
  // Assets
  cash: number
  accountsReceivable: number
  inventory: number
  totalAssets: number
  
  // Liabilities
  accountsPayable: number
  payrollTaxPayable: number
  totalLiabilities: number
  
  // Equity
  equity: number
  retainedEarnings: number
  totalEquity: number
}

export interface BalanceSheetSnapshot {
  date: Date
  accounts: BalanceSheetAccounts
  checksum: number // Assets - Liabilities - Equity should equal 0
}

export class BalanceSheetRule {
  private snapshots: BalanceSheetSnapshot[] = []
  
  constructor() {}
  
  /**
   * Process GL transactions to update balance sheet accounts
   * Should be called at the end of each month
   */
  processMonth(gl: GeneralLedger, date: Date): BalanceSheetSnapshot {
    const transactions = gl.getTransactions()
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0) // Last day of month
    
    // Get previous snapshot as starting point
    const previousSnapshot = this.getPreviousSnapshot(monthEnd)
    const accounts: BalanceSheetAccounts = previousSnapshot 
      ? { ...previousSnapshot.accounts } 
      : this.getInitialAccounts()
    
    // Process all transactions up to month end
    const relevantTransactions = transactions.filter(t => 
      t.date <= monthEnd && 
      (previousSnapshot ? t.date > previousSnapshot.date : true)
    )
    
    for (const transaction of relevantTransactions) {
      this.applyTransaction(accounts, transaction)
    }
    
    // Calculate totals
    accounts.totalAssets = accounts.cash + accounts.accountsReceivable + accounts.inventory
    accounts.totalLiabilities = accounts.accountsPayable + accounts.payrollTaxPayable
    accounts.totalEquity = accounts.equity + accounts.retainedEarnings
    
    // Create snapshot
    const snapshot: BalanceSheetSnapshot = {
      date: monthEnd,
      accounts,
      checksum: accounts.totalAssets - accounts.totalLiabilities - accounts.totalEquity
    }
    
    // Verify balance sheet equation
    if (Math.abs(snapshot.checksum) > 0.01) {
      console.warn(`Balance sheet out of balance by $${snapshot.checksum.toFixed(2)} on ${monthEnd.toDateString()}`)
    }
    
    this.snapshots.push(snapshot)
    return snapshot
  }
  
  /**
   * Apply a single transaction to balance sheet accounts
   */
  private applyTransaction(accounts: BalanceSheetAccounts, transaction: Transaction): void {
    const amount = transaction.debit - transaction.credit
    
    switch (transaction.account) {
      case 'Cash':
        accounts.cash += amount
        break
      case 'AccountsReceivable':
        accounts.accountsReceivable += amount
        break
      case 'Inventory':
        accounts.inventory += amount
        break
      case 'PayrollTaxPayable':
        accounts.payrollTaxPayable -= amount // Liabilities increase with credits
        break
      case 'Equity':
        accounts.equity -= amount // Equity increases with credits
        break
      case 'SalesRevenue':
        // Revenue increases retained earnings (credit balance)
        accounts.retainedEarnings += transaction.credit - transaction.debit
        break
      case 'COGS':
      case 'OpEx':
        // Expenses decrease retained earnings (debit balance)
        accounts.retainedEarnings -= transaction.debit - transaction.credit
        break
    }
  }
  
  /**
   * Get initial balance sheet accounts
   */
  private getInitialAccounts(): BalanceSheetAccounts {
    return {
      cash: 0,
      accountsReceivable: 0,
      inventory: 0,
      totalAssets: 0,
      accountsPayable: 0,
      payrollTaxPayable: 0,
      totalLiabilities: 0,
      equity: 0,
      retainedEarnings: 0,
      totalEquity: 0
    }
  }
  
  /**
   * Get the most recent snapshot before a given date
   */
  private getPreviousSnapshot(date: Date): BalanceSheetSnapshot | null {
    const previousSnapshots = this.snapshots.filter(s => s.date < date)
    return previousSnapshots.length > 0 
      ? previousSnapshots[previousSnapshots.length - 1]
      : null
  }
  
  /**
   * Get balance sheet at a specific date
   */
  getBalanceSheet(date: Date): BalanceSheetSnapshot | null {
    const snapshots = this.snapshots.filter(s => 
      s.date.getFullYear() === date.getFullYear() &&
      s.date.getMonth() === date.getMonth()
    )
    return snapshots.length > 0 ? snapshots[0] : null
  }
  
  /**
   * Get all balance sheet snapshots
   */
  getAllSnapshots(): BalanceSheetSnapshot[] {
    return [...this.snapshots]
  }
  
  /**
   * Get current (most recent) balance sheet
   */
  getCurrentBalanceSheet(): BalanceSheetSnapshot | null {
    return this.snapshots.length > 0 
      ? this.snapshots[this.snapshots.length - 1]
      : null
  }
  
  /**
   * Generate balance sheet report
   */
  generateReport(date?: Date): string {
    const snapshot = date 
      ? this.getBalanceSheet(date)
      : this.getCurrentBalanceSheet()
      
    if (!snapshot) {
      return 'No balance sheet data available'
    }
    
    const { accounts } = snapshot
    
    return `
Balance Sheet - ${snapshot.date.toDateString()}
${'='.repeat(50)}

ASSETS
  Current Assets:
    Cash:                  $${accounts.cash.toLocaleString()}
    Accounts Receivable:   $${accounts.accountsReceivable.toLocaleString()}
    Inventory:             $${accounts.inventory.toLocaleString()}
  Total Assets:            $${accounts.totalAssets.toLocaleString()}

LIABILITIES
  Current Liabilities:
    Accounts Payable:      $${accounts.accountsPayable.toLocaleString()}
    Payroll Tax Payable:   $${accounts.payrollTaxPayable.toLocaleString()}
  Total Liabilities:       $${accounts.totalLiabilities.toLocaleString()}

EQUITY
  Owner's Equity:          $${accounts.equity.toLocaleString()}
  Retained Earnings:       $${accounts.retainedEarnings.toLocaleString()}
  Total Equity:            $${accounts.totalEquity.toLocaleString()}

Total Liab. + Equity:      $${(accounts.totalLiabilities + accounts.totalEquity).toLocaleString()}

Balance Check:             $${snapshot.checksum.toFixed(2)}
`
  }
  
  /**
   * Export balance sheet data for analysis
   */
  exportData(): {
    snapshots: BalanceSheetSnapshot[]
    summary: {
      initialEquity: number
      finalEquity: number
      equityGrowth: number
      maxCash: number
      minCash: number
      avgInventory: number
    }
  } {
    if (this.snapshots.length === 0) {
      return {
        snapshots: [],
        summary: {
          initialEquity: 0,
          finalEquity: 0,
          equityGrowth: 0,
          maxCash: 0,
          minCash: 0,
          avgInventory: 0
        }
      }
    }
    
    const firstSnapshot = this.snapshots[0]
    const lastSnapshot = this.snapshots[this.snapshots.length - 1]
    
    const cashValues = this.snapshots.map(s => s.accounts.cash)
    const inventoryValues = this.snapshots.map(s => s.accounts.inventory)
    
    return {
      snapshots: this.getAllSnapshots(),
      summary: {
        initialEquity: firstSnapshot.accounts.totalEquity,
        finalEquity: lastSnapshot.accounts.totalEquity,
        equityGrowth: lastSnapshot.accounts.totalEquity - firstSnapshot.accounts.totalEquity,
        maxCash: Math.max(...cashValues),
        minCash: Math.min(...cashValues),
        avgInventory: inventoryValues.reduce((a, b) => a + b, 0) / inventoryValues.length
      }
    }
  }
}