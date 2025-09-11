
import { prisma } from '@/utils/database'
import GLEntryService from './GLEntryService'
import { getWeekNumber, getWeekDateRange } from '@/lib/utils/weekHelpers'

interface ExpenseAnalysisResult {
  expenses: Array<{
    id: string
    date: Date
    weekStarting: Date
    category: string
    subcategory: string | null
    description: string
    amount: number
    type: string
    vendor: string
    isRecurring: boolean
    metadata: any
  }>
  source: string
}

export class GLExpenseAnalysisService {
  private static instance: GLExpenseAnalysisService
  private glEntryService: GLEntryService

  private constructor() {
    this.glEntryService = GLEntryService.getInstance()
  }

  static getInstance(): GLExpenseAnalysisService {
    if (!GLExpenseAnalysisService.instance) {
      GLExpenseAnalysisService.instance = new GLExpenseAnalysisService()
    }
    return GLExpenseAnalysisService.instance
  }

  /**
   * Get weekly expense summary from GL entries
   */
  async getWeeklyExpenseSummary(year: number, quarter?: number): Promise<ExpenseAnalysisResult> {
    // Get GL entries
    const entries = await this.glEntryService.getEntries()
    
    // Filter expense entries (accounts 5000-5999)
    const expenseEntries = entries.filter(entry => {
      const accountNumber = this.extractAccountNumber(entry.accountCode || entry.category || '')
      return accountNumber >= 5000 && accountNumber < 6000
    })
    
    // Get date range
    const { startDate, endDate } = this.getDateRange(year, quarter)
    
    // Filter by date range and group by week
    const weeklyExpenses = this.groupEntriesByWeek(expenseEntries, startDate, endDate, year)
    
    // Transform to expense format
    const expenses = this.transformToExpenseFormat(weeklyExpenses, year)
    
    // Sort by date
    expenses.sort((a, b) => a.date.getTime() - b.date.getTime())
    
    return { 
      expenses,
      source: 'gl-entries'
    }
  }

  /**
   * Extract account number from account string
   */
  private extractAccountNumber(account: string): number {
    const [accountNum] = account.split(' - ')
    return parseInt(accountNum) || 0
  }

  /**
   * Get date range for the specified year and optional quarter
   */
  private getDateRange(year: number, quarter?: number): { startDate: Date, endDate: Date } {
    if (quarter && quarter >= 1 && quarter <= 4) {
      const quarterMonths = {
        1: { start: 0, end: 2 },  // Jan-Mar
        2: { start: 3, end: 5 },  // Apr-Jun
        3: { start: 6, end: 8 },  // Jul-Sep
        4: { start: 9, end: 11 }  // Oct-Dec
      }
      
      const months = quarterMonths[quarter as keyof typeof quarterMonths]
      return {
        startDate: new Date(year, months.start, 1),
        endDate: new Date(year, months.end + 1, 0)
      }
    }
    
    return {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31)
    }
  }

  /**
   * Group GL entries by week
   */
  private groupEntriesByWeek(
    entries: any[], 
    startDate: Date, 
    endDate: Date, 
    year: number
  ): Record<string, any[]> {
    const weeklyExpenses: Record<string, any[]> = {}
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.date)
      
      // Check if entry is in date range
      if (entryDate >= startDate && entryDate <= endDate) {
        // Calculate week number for this entry
        const weekNum = getWeekNumber(entryDate)
        const weekKey = `${year}-W${weekNum.toString().padStart(2, '0')}`
        
        if (!weeklyExpenses[weekKey]) {
          weeklyExpenses[weekKey] = []
        }
        
        // Add to weekly expenses
        weeklyExpenses[weekKey].push({
          date: entry.date,
          account: entry.accountCode || entry.category,
          description: entry.description,
          amount: Math.abs(entry.amount), // Convert to positive for expenses
          category: this.mapAccountToCategory(entry.accountCode || entry.category),
          subcategory: this.mapAccountToSubcategory(entry.accountCode || entry.category)
        })
      }
    })
    
    return weeklyExpenses
  }

  /**
   * Transform weekly grouped data to expense format
   */
  private transformToExpenseFormat(weeklyExpenses: Record<string, any[]>, year: number): any[] {
    const expenses: any[] = []
    
    Object.entries(weeklyExpenses).forEach(([weekKey, weekEntries]) => {
      // Group by category within each week
      const categoryTotals: Record<string, number> = {}
      const subcategoryTotals: Record<string, Record<string, number>> = {}
      
      weekEntries.forEach(entry => {
        if (!categoryTotals[entry.category]) {
          categoryTotals[entry.category] = 0
        }
        categoryTotals[entry.category] += entry.amount
        
        if (entry.subcategory) {
          if (!subcategoryTotals[entry.category]) {
            subcategoryTotals[entry.category] = {}
          }
          if (!subcategoryTotals[entry.category][entry.subcategory]) {
            subcategoryTotals[entry.category][entry.subcategory] = 0
          }
          subcategoryTotals[entry.category][entry.subcategory] += entry.amount
        }
      })
      
      // Create expense records
      Object.entries(categoryTotals).forEach(([category, amount]) => {
        if (subcategoryTotals[category]) {
          // Create separate entries for each subcategory
          Object.entries(subcategoryTotals[category]).forEach(([subcategory, subAmount]) => {
            const weekNum = parseInt(weekKey.split('-W')[1])
            const weekRange = getWeekDateRange(year, weekNum)
            
            expenses.push({
              id: `gl-${weekKey}-${category}-${subcategory}`,
              date: weekRange.start,
              weekStarting: weekRange.start,
              category,
              subcategory,
              description: `${category} - ${subcategory}`,
              amount: subAmount,
              type: 'gl',
              vendor: 'Various',
              isRecurring: false,
              metadata: { source: 'gl-entries' }
            })
          })
        } else {
          // Single entry for category without subcategories
          const weekNum = parseInt(weekKey.split('-W')[1])
          const weekRange = getWeekDateRange(year, weekNum)
          
          expenses.push({
            id: `gl-${weekKey}-${category}`,
            date: weekRange.start,
            weekStarting: weekRange.start,
            category,
            subcategory: null,
            description: category,
            amount,
            type: 'gl',
            vendor: 'Various',
            isRecurring: false,
            metadata: { source: 'gl-entries' }
          })
        }
      })
    })
    
    return expenses
  }

  /**
   * Map GL account to expense category
   */
  private mapAccountToCategory(account: string): string {
    const [accountNum, accountName] = account.split(' - ')
    const num = parseInt(accountNum) || 0
    
    // Based on standard GL account numbering
    if (num >= 5000 && num < 5100) return 'Cost of Goods Sold'
    if (num >= 5100 && num < 5200) return 'Operating Expenses'
    if (num >= 5200 && num < 5310) return 'Marketing'
    if (num >= 5310 && num < 5400) return 'Amazon Fees'
    if (num >= 5400 && num < 5500) return 'Payroll'
    if (num >= 5500 && num < 5600) return 'Rent & Utilities'
    if (num >= 5600 && num < 5700) return 'Professional Services'
    if (num >= 5700 && num < 5800) return 'Other Expenses'
    if (num >= 5800 && num < 5900) return 'Taxes'
    if (num >= 5900 && num < 6000) return 'Interest & Fees'
    
    // Fallback to account name
    if (accountName?.includes('Amazon')) return 'Amazon Fees'
    if (accountName?.includes('Payroll')) return 'Payroll'
    if (accountName?.includes('Rent')) return 'Rent'
    if (accountName?.includes('Tax')) return 'Taxes'
    
    return 'Other Expenses'
  }

  /**
   * Map GL account to subcategory
   */
  private mapAccountToSubcategory(account: string): string | null {
    const [, accountName] = account.split(' - ')
    
    if (!accountName) return null
    
    // Extract subcategory from account name if present
    if (accountName.includes('FBA')) return 'FBA Fees'
    if (accountName.includes('Referral')) return 'Referral Fee'
    if (accountName.includes('Advertising') || accountName.includes('PPC')) return 'Advertising'
    if (accountName.includes('Payroll Tax')) return 'Payroll Taxes'
    
    return null
  }

  /**
   * Get expense breakdown by category
   */
  async getExpenseBreakdown(year: number, quarter?: number) {
    const { expenses } = await this.getWeeklyExpenseSummary(year, quarter)
    
    const breakdown: Record<string, {
      total: number
      subcategories: Record<string, number>
      percentage: number
    }> = {}
    
    let totalExpenses = 0
    
    // Calculate totals by category
    expenses.forEach(expense => {
      if (!breakdown[expense.category]) {
        breakdown[expense.category] = {
          total: 0,
          subcategories: {},
          percentage: 0
        }
      }
      
      breakdown[expense.category].total += expense.amount
      totalExpenses += expense.amount
      
      if (expense.subcategory) {
        if (!breakdown[expense.category].subcategories[expense.subcategory]) {
          breakdown[expense.category].subcategories[expense.subcategory] = 0
        }
        breakdown[expense.category].subcategories[expense.subcategory] += expense.amount
      }
    })
    
    // Calculate percentages
    Object.keys(breakdown).forEach(category => {
      breakdown[category].percentage = totalExpenses > 0 
        ? (breakdown[category].total / totalExpenses) * 100 
        : 0
    })
    
    return {
      breakdown,
      totalExpenses,
      expenseCount: expenses.length
    }
  }
}

export default GLExpenseAnalysisService