export const BANK_FEES_RULE = {
  code: '5600',
  name: 'Bank Fees',
  amount: 100,
  frequency: 'monthly',
  description: 'Bank and financial service fees',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    return {
      code: '5600',
      amount: 100
    }
  }
}