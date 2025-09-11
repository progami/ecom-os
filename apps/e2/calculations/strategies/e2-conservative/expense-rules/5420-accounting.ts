/**
 * Accounting Expense Rule (Account 5420)
 * 
 * QuickBooks and tax filing services:
 * - QuickBooks: $70/month (charged monthly)
 * - Tax Filing: $500/quarter (charged quarterly on weeks 1, 14, 27, 40)
 * 
 * Payment Frequency: Mixed (monthly + quarterly)
 */

export const ACCOUNTING_RULE = {
  code: '5420',
  name: 'Accounting',
  frequency: 'mixed',
  description: 'QuickBooks and tax filing services',
  
  getExpense(year: number, week: number, quarter: number) {
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Monthly QuickBooks charges
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    const isMonthlyWeek = monthlyWeeks.includes(week)
    
    // Quarterly tax filing charges
    const quarterlyWeeks = [1, 14, 27, 40]
    const isQuarterlyWeek = quarterlyWeeks.includes(week)
    
    let amount = 0
    
    if (isMonthlyWeek) {
      amount += 70 // QuickBooks monthly
    }
    
    if (isQuarterlyWeek) {
      amount += 500 // Tax filing quarterly
    }
    
    if (amount > 0) {
      return {
        week,
        code: '5420',
        amount: amount
      }
    }
    
    return null
  }
}