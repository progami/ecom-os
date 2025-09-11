/**
 * Expense Rules Index
 * 
 * Centralized configuration for all expense rules
 * Each rule file contains:
 * - Business justification
 * - Cost breakdown
 * - Payment frequency
 * - Implementation logic
 */

// Type definition for expense rules
interface LegacyExpenseRule {
  code: string
  name: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'
  description?: string
  weeklyAmount?: number
  monthlyAmount?: number
  getExpense: (year: number, week: number, quarter: number) => { code: string; amount: number } | null
}

// Import all expense rules
import { LAND_FREIGHT_RULE } from './5031-land-freight'
import { PAYROLL_COMBINED_RULE } from './5100-payroll-combined'
import { CONTRACT_SALARIES_RULE } from './5120-contract-salaries'
import { FREELANCE_SERVICES_RULE } from './5130-freelance-services'
import { RENT_RULE } from './5200-rent'
import { UTILITIES_RULE } from './5210-utilities'
import { INTERNET_RULE } from './5220-internet'
import { OFFICE_SUPPLIES_RULE } from './5230-office-supplies'
import { INSURANCE_RULE } from './5240-insurance'
import { LEGAL_COMPLIANCE_RULE } from './5410-legal-compliance'
import { ACCOUNTING_RULE } from './5420-accounting'
import { IT_SOFTWARE_RULE } from './5500-it-software'
import { BANK_FEES_RULE } from './5600-bank-fees'
import { TRAVEL_RULE } from './5700-travel'
import { MEALS_ENTERTAINMENT_RULE } from './5710-meals-entertainment'
// Note: cashback (4900) is handled separately via cashback.ts after all expenses are created
// Note: inventory-adjustment is handled separately via create-inventory-adjustments.ts

// Export all rules as a collection
export const EXPENSE_RULES = {
  // Note: 4900 (cashback) is handled separately after expense creation
  
  // COGS Expenses
  '5031': LAND_FREIGHT_RULE,
  
  // Operating Expenses - Payroll (Combined rule returns both 5100 and 5110)
  '5100-5110': PAYROLL_COMBINED_RULE,
  '5120': CONTRACT_SALARIES_RULE,
  '5130': FREELANCE_SERVICES_RULE,
  
  // Operating Expenses - Facilities
  '5200': RENT_RULE,
  '5210': UTILITIES_RULE,
  '5220': INTERNET_RULE,
  '5230': OFFICE_SUPPLIES_RULE,
  '5240': INSURANCE_RULE,
  
  // Operating Expenses - Professional Services
  '5410': LEGAL_COMPLIANCE_RULE,
  '5420': ACCOUNTING_RULE,
  
  // Operating Expenses - Software & Tech
  '5500': IT_SOFTWARE_RULE,
  
  // Operating Expenses - Other
  '5600': BANK_FEES_RULE,
  '5700': TRAVEL_RULE,
  '5710': MEALS_ENTERTAINMENT_RULE,
}

// Helper function to get all expenses for a given period
export function getExpensesForPeriod(year: number, week: number, quarter: number) {
  const expenses = []
  
  for (const [code, rule] of Object.entries(EXPENSE_RULES)) {
    const expense = rule.getExpense(year, week, quarter)
    if (expense) {
      expenses.push(expense)
    }
  }
  
  return expenses
}

// Helper to get total annual cost for all rules
export function getTotalAnnualCost() {
  let total = 0
  
  for (const rule of Object.values(EXPENSE_RULES)) {
    if (rule.frequency === 'weekly' && 'weeklyAmount' in rule && typeof rule.weeklyAmount === 'number') {
      total += rule.weeklyAmount * 52
    } else if (rule.frequency === 'monthly' && 'monthlyAmount' in rule && typeof rule.monthlyAmount === 'number') {
      total += rule.monthlyAmount * 12
    }
  }
  
  return total
}