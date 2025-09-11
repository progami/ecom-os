import { EXPENSE_RULES } from '../business-logic'

/**
 * Contract Salaries Expense Rule (Account 5120)
 * 
 * Business Justification:
 * Outsourced development and operations team in Pakistan
 * Cost-effective talent for technical and business operations
 * 
 * Base Team (Constant):
 * - Umair: 150,000 PKR/month ($540 USD @ 278 PKR/USD) - Lead Developer
 * - Hashar: 120,000 PKR/month ($432 USD @ 278 PKR/USD) - Senior Developer
 * - Hamad: 100,000 PKR/month ($360 USD @ 278 PKR/USD) - Developer
 * - Mohsin: 100,000 PKR/month ($360 USD @ 278 PKR/USD) - Developer
 * Base Total: 470,000 PKR/month ($1,692 USD)
 * 
 * Additional 1099 Contractors (300,000 PKR/month each = $1,080 USD):
 * - 2025-2026: Base team only = $1,692/month
 * - 2027: Base + 1 contractor = $2,772/month
 * - 2028: Base + 2 contractors = $3,852/month
 * - 2029: Base + 3 contractors = $4,932/month
 * - 2030: Base + 4 contractors = $6,012/month
 * 
 * Payment Frequency: Monthly (first week of each month)
 * Started: From business inception (W40 2025)
 * 
 * Note: Exchange rate of 278 PKR/USD
 */

export const CONTRACT_SALARIES_RULE = {
  code: '5120',
  name: 'Contract Salaries',
  frequency: 'monthly',
  description: 'Contract developer salaries in Pakistan + 1099 contractors',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W40 in 2025
    if (year === 2025 && week < 40) return null
    
    // Calculate amount based on year
    let amount = EXPENSE_RULES.CONTRACT_SALARIES.BASE_MONTHLY // Base team
    
    if (year >= EXPENSE_RULES.CONTRACT_SALARIES.START_YEAR_CONTRACTORS) {
      const additionalContractors = Math.min(
        year - (EXPENSE_RULES.CONTRACT_SALARIES.START_YEAR_CONTRACTORS - 1), 
        EXPENSE_RULES.CONTRACT_SALARIES.MAX_CONTRACTORS
      )
      amount += additionalContractors * EXPENSE_RULES.CONTRACT_SALARIES.CONTRACTOR_MONTHLY
    }
    
    return {
      code: '5120',
      amount: amount
    }
  }
}