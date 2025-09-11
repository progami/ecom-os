export const LEGAL_COMPLIANCE_RULE = {
  code: '5410',
  name: 'Legal & Compliance',
  amount: 500,
  frequency: 'quarterly',
  description: 'Legal services and compliance costs - quarterly',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on first week of each quarter
    const quarterlyWeeks = [1, 14, 27, 40]
    if (!quarterlyWeeks.includes(week)) return null
    
    // Skip Q4 2025 - already handled via bank statement ($1,420 + $1 = $1,421)
    if (year === 2025 && quarter === 4) return null
    
    // Start from Q1 2026
    if (year === 2025) return null
    
    return {
      code: '5410',
      amount: 500
    }
  }
}