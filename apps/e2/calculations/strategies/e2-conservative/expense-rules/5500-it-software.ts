/**
 * IT Software Expense Rule (Account 5500)
 * 
 * Business Justification:
 * Essential software tools for running an Amazon FBA business
 * 
 * Services Included:
 * - Data Dive + Inner Circle: $2,500/year ($208.33/month)
 *   Amazon analytics and mastermind group membership
 * 
 * - Google Workspace: $20/employee/month
 *   Based on current headcount:
 *   - 1 owner/manager (assumed)
 *   - 4 contract developers (Umair, Hashar, Hamad, Mohsin)
 *   Total: 5 employees × $20 = $100/month
 * 
 * Total Monthly Cost: $308.33 (rounded to $310)
 * Annual Cost: $3,700 ($2,500 + $1,200)
 * 
 * Payment Frequency: Monthly (first week of each month)
 * Started: From business inception (W40 2025)
 */

export const IT_SOFTWARE_RULE = {
  code: '5500',
  name: 'IT Software',
  amount: 310,
  frequency: 'monthly',
  description: 'Data Dive + Inner Circle, Google Workspace',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks (1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48)
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    return {
      week,
      code: '5500',
      amount: this.amount
    }
  }
}