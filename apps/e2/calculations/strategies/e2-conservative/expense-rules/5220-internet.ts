/**
 * Internet/Telephone Expense Rule (Account 5220)
 * 
 * Business internet and telephone services:
 * - 2025-2026: $100/month
 * - 2027-2030+: $200/month
 * 
 * Payment Frequency: Monthly (first week of each month)
 */

export const INTERNET_RULE = {
  code: '5220',
  name: 'Internet/Telephone',
  frequency: 'monthly',
  description: 'Business internet and telephone services',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Calculate amount based on year
    let amount = 100 // Default 2025-2026
    
    if (year >= 2027) {
      amount = 200
    }
    
    return {
      week,
      code: '5220',
      amount: amount
    }
  }
}