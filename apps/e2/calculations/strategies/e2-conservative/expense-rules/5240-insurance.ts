/**
 * Insurance Expense Rule (Account 5240)
 * 
 * Business insurance scaling proportionally with rent:
 * - Monthly premiums scale with rent growth
 * - Annual liability insurance: $500/year (paid week 1)
 * 
 * Monthly amounts:
 * - 2025-2026: $80/month (rent $687)
 * - 2027-2028: $116/month (rent $1000, ~45% increase)
 * - 2029: $174/month (rent $1500, ~118% increase)
 * - 2030+: $232/month (rent $2000, ~191% increase)
 * 
 * Payment Frequency: Monthly + Annual payment on week 1
 */

export const INSURANCE_RULE = {
  code: '5240',
  name: 'Insurance',
  frequency: 'monthly',
  description: 'Business insurance (monthly + annual payment)',
  
  getExpense(year: number, week: number, quarter: number) {
    // Monthly payments on standard weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    const isMonthlyWeek = monthlyWeeks.includes(week)
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Annual liability payment on week 1 (after 2025)
    if (week === 1 && year > 2025) {
      // Calculate monthly premium based on year (proportional to rent)
      let monthlyAmount = 80 // Default 2025-2026
      
      if (year >= 2027 && year <= 2028) {
        monthlyAmount = 116 // ~45% increase
      } else if (year === 2029) {
        monthlyAmount = 174 // ~118% increase
      } else if (year >= 2030) {
        monthlyAmount = 232 // ~191% increase
      }
      
      // Return monthly + annual on week 1
      return {
        week,
        code: '5240',
        amount: monthlyAmount + 500 // Monthly + $500 annual
      }
    }
    
    // Regular monthly payments
    if (isMonthlyWeek) {
      let monthlyAmount = 80 // Default 2025-2026
      
      if (year >= 2027 && year <= 2028) {
        monthlyAmount = 116
      } else if (year === 2029) {
        monthlyAmount = 174
      } else if (year >= 2030) {
        monthlyAmount = 232
      }
      
      return {
        week,
        code: '5240',
        amount: monthlyAmount
      }
    }
    
    return null
  }
}