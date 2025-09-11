/**
 * Utilities Expense Rule (Account 5210)
 * 
 * Electricity, water, and other utilities with yearly increases:
 * - 2025: $50/month
 * - 2026: $100/month
 * - 2027: $150/month
 * - 2028: $200/month
 * - 2029-2030+: $300/month
 * 
 * Payment Frequency: Monthly (first week of each month)
 */

export const UTILITIES_RULE = {
  code: '5210',
  name: 'Utilities',
  frequency: 'monthly',
  description: 'Electricity, water, and other utilities',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Calculate utilities based on year
    let amount = 50 // Default 2025
    
    if (year === 2026) {
      amount = 100
    } else if (year === 2027) {
      amount = 150
    } else if (year === 2028) {
      amount = 200
    } else if (year >= 2029) {
      amount = 300
    }
    
    return {
      week,
      code: '5210',
      amount: amount
    }
  }
}