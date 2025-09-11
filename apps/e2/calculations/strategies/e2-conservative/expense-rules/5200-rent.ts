/**
 * Rent Expense Rule (Account 5200)
 * 
 * Office and warehouse rent with yearly increases:
 * - 2025-2026: $687/month
 * - 2027-2028: $1,000/month  
 * - 2029: $1,500/month
 * - 2030+: $2,000/month
 * 
 * Payment Frequency: Monthly (first week of each month)
 */

export const RENT_RULE = {
  code: '5200',
  name: 'Rent',
  frequency: 'monthly',
  description: 'Office and warehouse rent',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Calculate rent based on year
    let amount = 687 // Default 2025-2026
    
    if (year >= 2027 && year <= 2028) {
      amount = 1000
    } else if (year === 2029) {
      amount = 1500
    } else if (year >= 2030) {
      amount = 2000
    }
    
    return {
      code: '5200',
      amount: amount
    }
  }
}